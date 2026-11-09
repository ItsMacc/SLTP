"""Canary: prove the R2 read/write path with one tiny manifest field.

1. GETs META/manifest.json and prints TEXT_ADDED (expect: missing).
2. PUTs it back with TEXT_ADDED=TRUE.
3. GETs it again and prints TEXT_ADDED (expect: TRUE).

Stdlib only. Creds come from .env (never committed).
"""

import hashlib
import hmac
import json
import os
import time
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


def _load_dotenv() -> None:
    dotenv = Path(__file__).resolve().parent.parent / ".env"
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


_load_dotenv()
for mine, alts in (("R2_ACCESS_KEY_ID", ("CLOUDFLARE_ACCESS_KEY_ID",)),
                   ("R2_SECRET_ACCESS_KEY", ("CLOUDFLARE_SECRET_ACCESS_KEY",))):
    if mine not in os.environ:
        for alt in alts:
            if os.environ.get(alt):
                os.environ[mine] = os.environ[alt]
                break
ENDPOINT = os.environ.get("CLOUDFLARE_URL", "").rstrip("/") or \
    f"https://{os.environ['CLOUDFLARE_ACCOUNT_ID']}.r2.cloudflarestorage.com"
BUCKET = os.environ.get("R2_BUCKET", "sltp-market-data")
HOST = ENDPOINT.split("://", 1)[-1]


def _s3(method: str, key: str, body: bytes | None = None) -> bytes:
    key_id, secret = os.environ["R2_ACCESS_KEY_ID"], os.environ["R2_SECRET_ACCESS_KEY"]
    now = datetime.now(timezone.utc)
    stamp, datestamp = now.strftime("%Y%m%dT%H%M%SZ"), now.strftime("%Y%m%d")
    payload_hash = "UNSIGNED-PAYLOAD" if body is not None else hashlib.sha256(b"").hexdigest()
    headers = {"host": HOST, "x-amz-content-sha256": payload_hash, "x-amz-date": stamp}
    if body is not None:
        headers["content-type"] = "application/json"
        headers["content-length"] = str(len(body))
    signed = ";".join(sorted(headers))
    canonical = "\n".join([method, f"/{BUCKET}/{key}", "",
                            "\n".join(f"{k}:{headers[k]}" for k in sorted(headers)),
                            "", signed, payload_hash])
    scope = f"{datestamp}/auto/s3/aws4_request"
    to_sign = f"AWS4-HMAC-SHA256\n{stamp}\n{scope}\n{hashlib.sha256(canonical.encode()).hexdigest()}"

    def _sign(k: bytes, msg: str) -> bytes:
        return hmac.new(k, msg.encode(), hashlib.sha256).digest()

    signing = _sign(_sign(_sign(_sign(b"AWS4" + secret.encode(), datestamp), "auto"), "s3"), "aws4_request")
    headers["Authorization"] = (
        f"AWS4-HMAC-SHA256 Credential={key_id}/{scope}, "
        f"SignedHeaders={signed}, "
        f"Signature={hmac.new(signing, to_sign.encode(), hashlib.sha256).hexdigest()}")
    req = Request(f"https://{HOST}/{BUCKET}/{key}", data=body, headers=headers, method=method)
    last: BaseException | None = None
    for attempt in range(4):
        try:
            with urlopen(req, timeout=60) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if e.code is not None and 400 <= e.code < 500 and e.code != 429:
                raise
            last = e
        except Exception as e:
            last = e
        time.sleep(2 ** attempt)
    raise last  # type: ignore[misc]


manifest = json.loads(_s3("GET", "META/manifest.json").decode())
print("BEFORE:", repr(manifest.get("TEXT_ADDED")), "| version:", manifest.get("version"))
if os.environ.get("REMOVE"):
    manifest.pop("TEXT_ADDED", None)
else:
    manifest["TEXT_ADDED"] = "TRUE"
_s3("PUT", "META/manifest.json", json.dumps(manifest, indent=1).encode())
check = json.loads(_s3("GET", "META/manifest.json").decode())
print("AFTER: ", repr(check.get("TEXT_ADDED")), "| version:", check.get("version"))
