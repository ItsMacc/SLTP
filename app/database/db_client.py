# -------- Imports --------
import os
import requests
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

# -------- Environment Setup --------
load_dotenv()
TURSO_URL = os.getenv("TURSO_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")


# -------- Database Client --------
class TursoClient:
    def __init__(self,
                 url: str,
                 token: str
                 ) -> None:
        # Clean and format Turso database URL endpoint for HTTP pipeline requests
        cleaned_url = url.replace("libsql://", "").replace("https://", "")
        self.endpoint = f"https://{cleaned_url}/v2/pipeline"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        # Setup session with automated retries for transient network drops or timeouts
        self.session = requests.Session()
        retries = Retry(
            total=3,  # Number of retries
            backoff_factor=1,  # Wait 1s, 2s, 4s between retries
            status_forcelist=[500, 502, 503, 504],
            raise_on_status=False
        )
        adapter = HTTPAdapter(max_retries=retries)
        self.session.mount("https://", adapter)
        self.session.headers.update(self.headers)

    @staticmethod
    def _format_args(params: list | None):
        # Return empty list if no parameters are supplied
        if not params:
            return []

        # Format parameter types and values for Turso SQL execution payload
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

    def execute(self,
                sql: str,
                params: list | None = None
                ):
        # Construct the execution payload with SQL statement and formatted arguments
        payload = {
            "requests": [
                {
                    "type": "execute",
                    "stmt": {"sql": sql, "args": self._format_args(params)},
                },
                {"type": "close"},
            ]
        }

        # Send POST request to Turso endpoint and check response status
        resp = self.session.post(self.endpoint, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        # Parse query results and format rows into a standard container
        result_stmt = data["results"][0]["response"]["result"]
        raw_rows = result_stmt.get("rows", [])
        parsed_rows = [[col.get("value") for col in row] for row in raw_rows]

        class ResultWrapper:
            def __init__(self,
                         rows
                         ):
                self.rows = rows

        return ResultWrapper(parsed_rows)

    def batch(self,
              stmts: list
              ) -> None:
        requests_payload = []

        # Iterate through statements and format each for batch execution
        for stmt in stmts:
            if isinstance(stmt, tuple):
                sql, params = stmt
            else:
                sql, params = stmt, None

            requests_payload.append({
                "type": "execute",
                "stmt": {"sql": sql, "args": self._format_args(params)},
            })

        # Append final close instruction to batch payload
        requests_payload.append({"type": "close"})
        payload = {"requests": requests_payload}

        # Send batch request payload to the database endpoint
        resp = self.session.post(self.endpoint, json=payload, timeout=60)
        resp.raise_for_status()


# -------- Singleton Client Cache --------
_global_client = None


def get_db_client() -> TursoClient:
    global _global_client

    # Initialize global client instance if it does not already exist
    if _global_client is None:
        _global_client = TursoClient(TURSO_URL, TURSO_AUTH_TOKEN)

    return _global_client