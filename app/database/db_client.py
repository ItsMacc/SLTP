import os
import requests
from dotenv import load_dotenv

load_dotenv()

TURSO_URL = os.getenv("TURSO_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")


class TursoClient:
    def __init__(self, url: str, token: str):
        cleaned_url = url.replace("libsql://", "").replace("https://", "")
        self.endpoint = f"https://{cleaned_url}/v2/pipeline"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        # Persistent Session shared across all queries to maintain Keep-Alive
        self.session = requests.Session()
        self.session.headers.update(self.headers)

    @staticmethod
    def _format_args(params: list | None):
        if not params:
            return []
        args = []
        for p in params:
            if p is None:
                args.append({"type": "null"})
            elif isinstance(p, float):
                args.append({"type": "float", "value": p})
            elif isinstance(p, int):
                args.append({"type": "integer", "value": str(p)})
            else:
                args.append({"type": "text", "value": str(p)})
        return args

    def execute(self, sql: str, params: list | None = None):
        payload = {
            "requests": [
                {
                    "type": "execute",
                    "stmt": {"sql": sql, "args": self._format_args(params)},
                },
                {"type": "close"},
            ]
        }
        resp = self.session.post(self.endpoint, json=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        result_stmt = data["results"][0]["response"]["result"]
        raw_rows = result_stmt.get("rows", [])
        parsed_rows = [[col.get("value") for col in row] for row in raw_rows]

        class ResultWrapper:
            def __init__(self, rows):
                self.rows = rows

        return ResultWrapper(parsed_rows)

    def batch(self, stmts: list):
        requests_payload = []
        for stmt in stmts:
            if isinstance(stmt, tuple):
                sql, params = stmt
            else:
                sql, params = stmt, None

            requests_payload.append({
                "type": "execute",
                "stmt": {"sql": sql, "args": self._format_args(params)},
            })

        requests_payload.append({"type": "close"})
        payload = {"requests": requests_payload}

        resp = self.session.post(self.endpoint, json=payload, timeout=30)
        resp.raise_for_status()


# --- SINGLETON INSTANCE CACHE ---
_global_client = None

def get_db_client() -> TursoClient:
    global _global_client
    if _global_client is None:
        _global_client = TursoClient(TURSO_URL, TURSO_AUTH_TOKEN)
    return _global_client