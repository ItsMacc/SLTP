# defaults.py — the default state of a brand-new account.
#
# One definition, read by provisioning everywhere. If you change a default,
# every future account picks it up on creation; existing accounts keep
# whatever they already saved.
#
# Deliberately NOT defined here: portfolio defaults. A portfolio is NOT
# auto-created — its absence is the signal the frontend uses to show the
# onboarding wizard — so the wizard owns those values.

# -------- Settings --------
DEFAULT_SETTINGS: dict[str, object] = {
    "theme": "Light",
    "priceAlerts": False,
    "dailySummary": False,
    "tradeSignals": True,
    "riskTolerance": "Medium",
    "defaultTimeframe": "1y",
    # Bars the price chart may draw at once; "all" removes the ceiling. Kept as
    # a string so the row reads the same however it was written.
    "chartMaxBars": "1500",
    "securityWarnings": True,
    "autoTrackSignals": False,
    "editorFontSize": 14,
    "editorTabSize": 4,
    "editorWordWrap": False,
    "editorMinimap": False,
    "editorLineNumbers": True,
    "editorFontLigatures": True,
}


# -------- Helpers --------
# A fresh copy: callers mutate the result, so never hand out the original.
def default_settings() -> dict[str, object]:
    return dict(DEFAULT_SETTINGS)
