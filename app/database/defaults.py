# defaults.py — The default state of a brand-new account.
#
# One definition, used by BOTH stores, so a Turso row and a Supabase profile
# row can never disagree about what "default" means. If you change a default
# here, every future account picks it up on creation and existing accounts are
# untouched (they keep whatever they already saved).
#
#   DEFAULT_SETTINGS — settings_json on the Turso users row, and the settings
#                      blob on the Supabase public.users profile.
#
# Deliberately NOT defined here: portfolio defaults. A portfolio is NOT
# auto-created — its absence is the signal the frontend uses to show the
# onboarding wizard (see PortfolioPage) — so the wizard owns those values and
# hardcodes its own pre-fill in PortfolioOnboarding.tsx. Declaring a copy
# here would just be a fourth set of numbers that nothing reads.

# -------- Settings --------

DEFAULT_SETTINGS: dict[str, object] = {
    "theme": "Light",
    "priceAlerts": False,
    "dailySummary": False,
    "tradeSignals": True,
    "riskTolerance": "Medium",
    "defaultTimeframe": "1y",
    "securityWarnings": True,
    "autoTrackSignals": False,
    "editorFontSize": 14,
    "editorTabSize": 4,
    "editorWordWrap": False,
    "editorMinimap": False,
    "editorLineNumbers": True,
    "editorFontLigatures": True,
}


def default_settings() -> dict[str, object]:
    """A fresh copy — callers mutate the result, so never hand out the original."""
    return dict(DEFAULT_SETTINGS)
