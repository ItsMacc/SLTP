# lab_core.py — The read-only `core/` package shown inside every Lab project.
#
# The real modules live under `app/`. The Lab editor presents them as a `core/`
# package, so a project's own files can reach them by one stable path:
#
#   from core.strategy.base_strategy import Strategy
#   from core.portfolio.portfolio_manager import PortfolioManager
#   from core.utils.Order import Order
#   from core.utils.Trade import Trade
#   from core.utils.StockData import StockData
#
# The mirror is byte-for-byte the repo file apart from one thing: the imports
# *inside* those modules are rewritten to point at the mirrored package, so
# `core` stands on its own and the editor can resolve it. Imports of modules
# that are not part of the core tree (app.database.fetch) are left alone --
# they are backend-only calls, and the editor never runs the code.

from __future__ import annotations

import re
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]

# Project path -> the repo file it mirrors.
CORE_FILES: dict[str, Path] = {
    "core/portfolio/portfolio_manager.py": _REPO_ROOT / "app" / "engine" / "portfolio" / "portfolio_manager.py",
    "core/strategy/base_strategy.py": _REPO_ROOT / "app" / "engine" / "strategy" / "base_strategy.py",
    **{
        f"core/utils/{name}": _REPO_ROOT / "app" / "engine" / "utils" / name
        for name in (
            "Event.py",
            "EventType.py",
            "Order.py",
            "PositionType.py",
            "RebalanceFrequency.py",
            "StockData.py",
            "Trade.py",
        )
    },
}

# The root of the read-only package. Nothing under it can be written to.
CORE_ROOT = "core"

# Every folder the core package holds, derived from the files above. The editor
# uses this to draw the tree even though the package is never stored.
CORE_FOLDERS: tuple[str, ...] = tuple(sorted({
    "/".join(path.split("/")[:-1])
    for path in CORE_FILES
}))

# The packages that are mirrored into `core/`. `app.engine.strategy` is singular in
# the mirror, so it is listed on its own.
_MIRRORED_PACKAGES: tuple[tuple[str, str], ...] = (
    ("app.engine.portfolio", "core.portfolio"),
    ("app.engine.strategy", "core.strategy"),
    ("app.engine.utils", "core.utils"),
)

# `from app.engine.utils.StockData import StockData` and friends.
_FROM_IMPORT_RE = re.compile(r"^(\s*)from\s+(app\.[A-Za-z_][\w.]*)\s+import\b", re.MULTILINE)


def _rewrite_import(match: re.Match[str]) -> str:
    indent, module = match.group(1), match.group(2)
    for source, target in _MIRRORED_PACKAGES:
        if module == source or module.startswith(f"{source}."):
            return f"{indent}from {target}{module[len(source):]} import"
    return match.group(0)


def core_source(project_path: str) -> str:
    """The text of a core file, with its mirrored imports rewritten."""
    path = CORE_FILES[project_path]
    return _FROM_IMPORT_RE.sub(_rewrite_import, path.read_text(encoding="utf-8"))


def is_core_path(name: str) -> bool:
    """True when a project path points into the read-only core package."""
    return name == CORE_ROOT or name.startswith(f"{CORE_ROOT}/")
