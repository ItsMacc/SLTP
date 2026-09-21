import asyncio
import traceback
from datetime import datetime, timezone
from app.database import turso
from app.database.db import insert_or_update_data


async def refresh_user_cache_from_supabase(limit: int = 500) -> int:
    """
    Pulls all user profiles from Supabase and refreshes the users table,
    so the runner always has current emails + settings.
    """
    import requests
    import os

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE")
    if not url or not key:
        print("  [cache] SUPABASE_URL / SUPABASE_SERVICE_ROLE not set — skipping refresh")
        return 0

    try:
        resp = requests.get(
            f"{url}/rest/v1/users",
            params={"select": "id,name,email,settings", "limit": limit},
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            timeout=15,
        )
        resp.raise_for_status()
        users = resp.json()
    except Exception as e:
        print(f"  [cache] Supabase refresh failed: {e}")
        return 0

    for u in users:
        try:
            await turso.upsert_user(u["id"], u.get("name"), u.get("email"), u.get("settings"))
        except Exception as e:
            print(f"  [cache] Failed to cache user {u.get('id')}: {e}")
    return len(users)


async def run() -> dict:
    """Full daily run: update market data + refresh the user cache."""
    started = datetime.now(timezone.utc)
    print(f"=== SLTP daily runner — {started.isoformat()} ===")

    print("[data] Updating daily market bars in Parquet...")
    try:
        await asyncio.to_thread(insert_or_update_data)
        print("[data] Parquet update complete.")
    except Exception as e:
        print(f"[data] Failed to update Parquet file: {e}")

    refreshed = await refresh_user_cache_from_supabase()
    print(f"[cache] refreshed {refreshed} user(s) from Supabase")

    await turso.close()
    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    print(f"=== done in {elapsed:.1f}s ===")
    return {"refreshed": refreshed}


if __name__ == "__main__":
    asyncio.run(run())
