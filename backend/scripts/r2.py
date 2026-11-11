# r2.py — the one R2 transport every operator script uses.
#
# Before this file, daily_r2_update.py and restamp_manifest.py each carried
# their own copy of the SigV4 signer (~80 lines each, drifting apart).
# There is exactly one copy now: ``from r2 import s3``.
#
# Nothing here touches the network at import time. Endpoint and credentials
# resolve lazily inside s3(), so ``import r2`` never crashes on a machine
# whose .env is missing R2 keys — the script fails later with a message
# that names the missing variable instead.

# -------- Imports --------
import hashlib
import hmac
import os
import time
import urllib.error

from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


# -------- Repo-root .env --------
# Fills in only variables the environment does not already set, so exported
# values (CI, cron, launchd) always win over the file.
def load_dotenv() -> None:
    dotenv = Path(__file__).resolve().parent.parent.parent / ".env"
    if not dotenv.is_file():
        return
    for line in dotenv.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv()


# -------- Config (lazy) --------
def _config() -> tuple[str, str, str, str]:
    """Returns (host, bucket, key_id, secret), or raises naming the gap."""
    for mine, alts in (("R2_ACCESS_KEY_ID", ("CLOUDFLARE_ACCESS_KEY_ID",)),
                       ("R2_SECRET_ACCESS_KEY", ("CLOUDFLARE_SECRET_ACCESS_KEY",))):
        if mine not in os.environ:
            for alt in alts:
                if os.environ.get(alt):
                    os.environ[mine] = os.environ[alt]
                    break
    missing = [name for name in ("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")
               if not os.environ.get(name)]
    if missing:
        raise RuntimeError(
            f"Missing {', '.join(missing)} — set them in .env "
            "(R2 dashboard: Manage R2 API tokens).")
    endpoint = os.environ.get("CLOUDFLARE_URL", "").rstrip("/") or (
        f"https://{os.environ['CLOUDFLARE_ACCOUNT_ID']}.r2.cloudflarestorage.com"
        if os.environ.get("CLOUDFLARE_ACCOUNT_ID") else "")
    if not endpoint:
        raise RuntimeError("Missing CLOUDFLARE_URL or CLOUDFLARE_ACCOUNT_ID in .env.")
    bucket = os.environ.get("R2_BUCKET", "sltp-market-data")
    return endpoint.split("://", 1)[-1], bucket, \
        os.environ["R2_ACCESS_KEY_ID"], os.environ["R2_SECRET_ACCESS_KEY"]


# -------- Signed requests --------
def s3(method: str, key: str, body: bytes | None = None, timeout: int = 300) -> bytes:
    """One SigV4-signed R2 request. Retries 5xx/429; 4xx raise with R2's
    own XML error body attached, because a bare 403 once cost a full
    round of detective work (it was the secret, not the signing code)."""
    host, bucket, key_id, secret = _config()
    now = datetime.now(timezone.utc)
    stamp, datestamp = now.strftime("%Y%m%dT%H%M%SZ"), now.strftime("%Y%m%d")
    payload_hash = "UNSIGNED-PAYLOAD" if body is not None else hashlib.sha256(b"").hexdigest()
    headers = {"host": host, "x-amz-content-sha256": payload_hash, "x-amz-date": stamp}
    if body is not None:
        headers["content-type"] = "application/octet-stream"
        headers["content-length"] = str(len(body))
    signed = ";".join(sorted(headers))
    canonical = "\n".join([method, f"/{bucket}/{key}", "",
                           "\n".join(f"{k}:{headers[k]}" for k in sorted(headers)),
                           "", signed, payload_hash])
    scope = f"{datestamp}/auto/s3/aws4_request"
    to_sign = f"AWS4-HMAC-SHA256\n{stamp}\n{scope}\n{hashlib.sha256(canonical.encode()).hexdigest()}"

    def _sign(k: bytes, msg: str) -> bytes:
        return hmac.new(k, msg.encode(), hashlib.sha256).digest()

    sk = _sign(_sign(_sign(_sign(b"AWS4" + secret.encode(), datestamp), "auto"), "s3"), "aws4_request")
    headers["Authorization"] = (
        f"AWS4-HMAC-SHA256 Credential={key_id}/{scope}, "
        f"SignedHeaders={signed}, "
        f"Signature={hmac.new(sk, to_sign.encode(), hashlib.sha256).hexdigest()}")
    req = Request(f"https://{host}/{bucket}/{key}", data=body, headers=headers, method=method)
    last: BaseException | None = None
    for attempt in range(4):
        try:
            with urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if e.code is not None and 400 <= e.code < 500 and e.code != 429:
                try:
                    detail = e.read().decode(errors="replace")
                except Exception:
                    detail = ""
                raise RuntimeError(f"R2 {e.code} on {method} {key}: {detail}") from e
            last = e
        except Exception as e:
            last = e
        time.sleep(2 ** attempt)
    raise last  # type: ignore[misc]
