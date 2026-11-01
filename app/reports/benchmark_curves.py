# -------- benchmark_curves.py --------
# Store the benchmark's equity curve for every reported window. Run once.
#
#   python -m app.reports.benchmark_curves
#
# The strategy charts overlay these curves, and strategy_curves.py rebuilds this store
# itself when it is missing, so a manual run is only needed after a data refresh.

# -------- Imports --------
# Report imports
from app.reports import curve_store


# -------- Entry Point --------
def main() -> int:
    name: str = curve_store.strategy_label(curve_store.BENCHMARK_ID)
    print(f"{name} over {len(curve_store.PERIODS)} windows")

    periods = curve_store.run_all(curve_store.BENCHMARK_ID)
    path: str = curve_store.save_curves(curve_store.BENCHMARK_ID, periods)
    print(f"Stored {len(periods)} curve(s) in {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
