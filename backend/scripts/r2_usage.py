"""Print R2 Class A and Class B operation counts for the current billing month.

Same numbers as the dashboard's bucket Metrics tab. Stdlib only.

USAGE (from backend/):
    ../.venv/bin/python scripts/r2_usage.py

Setup: set these two env vars in the repo-root .env first:

    CLOUDFLARE_API_TOKEN=<token with analytics read on the account>
    CLOUDFLARE_ACCOUNT_ID=<account id>
"""

# -------- Imports --------
import json
import os
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # sibling r2.py

from r2 import load_dotenv

BUCKET = "sltp-market-data"
BILLING_RESET_DAY = 6  # SLTP monthly billing cycle reset day

# LIMITS
CLASS_A_LIMIT = 1_000_000
CLASS_B_LIMIT = 10_000_000

CLASS_A = {
    "listbuckets", "putbucket", "listobjects", "putobject", "copyobject",
    "completemultipartupload", "createmultipartupload",
    "lifecyclestoragetiertransition", "listmultipartuploads", "uploadpart",
    "uploadpartcopy", "listparts", "putbucketencryption", "putbucketcors",
    "putbucketlifecycleconfiguration",
}
CLASS_B = {
    "headbucket", "headobject", "getobject", "usagesummary",
    "getbucketencryption", "getbucketlocation", "getbucketcors",
    "getbucketlifecycleconfiguration",
}

QUERY = """
query ($accountTag: String!, $startDate: Time, $endDate: Time, $bucketName: String) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      r2OperationsAdaptiveGroups(
        limit: 10000
        filter: { datetime_geq: $startDate, datetime_leq: $endDate, bucketName: $bucketName }
      ) {
        sum { requests }
        dimensions { actionType }
      }
    }
  }
}
"""


def get_r2_usage(bucket: str = BUCKET) -> dict[str, int]:
    load_dotenv()

    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account_id:
        raise RuntimeError(
            "Missing CLOUDFLARE_API_TOKEN and/or CLOUDFLARE_ACCOUNT_ID env vars."
        )

    end = datetime.now(timezone.utc)
    if end.day >= BILLING_RESET_DAY:
        start = end.replace(day=BILLING_RESET_DAY, hour=0, minute=0, second=0, microsecond=0)
    else:
        prev_month = end.replace(day=1) - timedelta(days=1)
        start = prev_month.replace(day=BILLING_RESET_DAY, hour=0, minute=0, second=0, microsecond=0)

    payload = {
        "query": QUERY,
        "variables": {
            "accountTag": account_id,
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "bucketName": bucket,
        },
    }

    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/graphql",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode())

    if body.get("errors"):
        raise RuntimeError(json.dumps(body["errors"], indent=2))

    groups = body["data"]["viewer"]["accounts"][0]["r2OperationsAdaptiveGroups"]

    class_a = class_b = 0
    for g in groups:
        action = "".join(c for c in g["dimensions"]["actionType"].lower() if c.isalnum())
        n = g["sum"]["requests"]
        if action in CLASS_A:
            class_a += n
        elif action in CLASS_B:
            class_b += n

    return {"class_a": class_a, "class_b": class_b}


if __name__ == "__main__":
    try:
        usage = get_r2_usage()
        print(f"Bucket: {BUCKET}")
        print(f"Class A: {usage['class_a']:,}")
        print(f"Class B: {usage['class_b']:,}")
    except Exception as e:
        raise SystemExit(str(e))
