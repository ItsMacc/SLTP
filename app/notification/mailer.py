# mailer.py — SLTP notification emails (HTML, mobile-friendly).
#
# Notification emails share one HTML boilerplate. Strategy-signal emails
# receive fields from the current engine's Order records and close prices.

# Every email ends with a notice pointing to Settings -> Notifications.
# Layout uses inline styles + table markup so it renders correctly in Gmail,
# Outlook and mobile mail clients.

# USAGE: python -m app.notification.email <to> <kind> [user_name]

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from dotenv import load_dotenv

load_dotenv()

BRAND = "SLTP"
SENDER_NAME = "SLTP"
FOOTER_HTML = (
    '<p style="margin:24px 0 0;color:#968f88;font-size:12px;line-height:1.5;'
    'border-top:1px solid #e6e0d4;padding-top:16px;">'
    "You are receiving this message because you have an SLTP account. "
    "You can disable these messages anytime in <strong>Settings &rarr; Notifications</strong>."
    "</p>"
)

# Palette (matches the app's light surface; email clients don't get CSS vars)
C_TEXT = "#3b373f"
C_MUTED = "#736d7a"
C_ACCENT = "#4f46e5"
C_GREEN = "#059669"
C_RED = "#dc2626"
C_BORDER = "#e6e0d4"
C_PANEL = "#faf8f2"


# -------- Low-Level Sender --------
def send_email(receiver: str, subject: str, html: str) -> tuple[bool, str | None]:
    """Sends an HTML email via Gmail SMTP. Returns (success, error_message)."""
    sender_email = os.environ.get("SENDER_EMAIL")
    app_password = os.environ.get("APP_PASSWORD")

    if not sender_email or not app_password:
        return False, "Missing SENDER_EMAIL or APP_PASSWORD in .env"

    message = MIMEMultipart("alternative")
    message["From"] = f"{SENDER_NAME} <{sender_email}>"
    message["To"] = receiver
    message["Subject"] = subject
    message.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, app_password)
            server.sendmail(sender_email, receiver, message.as_string())
        return True, None
    except Exception as e:
        return False, str(e)


# -------- Shared Boilerplate --------
def _shell(preheader: str, title: str, accent: str, inner_html: str) -> str:
    """Wraps content in the common branded frame (tables = email-safe layout)."""
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;">{preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;border:1px solid {C_BORDER};overflow:hidden;">
    <!-- Header -->
    <tr>
      <td style="padding:20px 28px;border-bottom:3px solid {accent};">
        <span style="font-family:Georgia,serif;font-size:22px;color:{C_TEXT};">{BRAND}</span>
        <span style="float:right;font-size:12px;color:{C_MUTED};letter-spacing:0.08em;text-transform:uppercase;">{title}</span>
      </td>
    </tr>
    <!-- Body -->
    <tr>
      <td style="padding:28px;color:{C_TEXT};font-size:15px;line-height:1.6;">
        {inner_html}
        {FOOTER_HTML}
      </td>
    </tr>
  </table>
  <p style="color:#b0a99f;font-size:11px;margin:16px 0 0;">&copy; {BRAND} &mdash; research-first market analysis</p>
</td></tr>
</table>
</body>
</html>"""


def _greeting(user_name: str) -> str:
    return f'<p style="margin:0 0 16px;">Hello <strong>{user_name}</strong>,</p>'


def _panel(label: str, rows: list[tuple[str, str, str]]) -> str:
    """Renders a labelled key-value panel. rows = [(label, value, value_color), ...]"""
    trs = "".join(
        f'<tr>'
        f'<td style="padding:8px 0;color:{C_MUTED};font-size:13px;width:45%;">{k}</td>'
        f'<td style="padding:8px 0;text-align:right;font-weight:600;font-size:14px;color:{v_color};">{v}</td>'
        f'</tr>'
        for k, v, v_color in rows
    )
    return (
        f'<p style="margin:0 0 8px;color:{C_MUTED};font-size:11px;font-weight:700;'
        f'letter-spacing:0.1em;text-transform:uppercase;">{label}</p>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:{C_PANEL};border:1px solid {C_BORDER};border-radius:10px;padding:12px 16px;">'
        f"{trs}</table>"
    )


def _btn(href: str, label: str) -> str:
    return (
        f'<a href="{href}" style="display:inline-block;margin-top:20px;background:{C_ACCENT};color:#ffffff;'
        f'text-decoration:none;font-weight:600;font-size:14px;padding:10px 22px;border-radius:8px;">{label}</a>'
    )


# -------- Trade Signal Email --------
def trade_signal_email(receiver: str, user_name: str, strategy_name: str,
                       ticker: str, signal_type: str, price: float | None,
                       confidence: float | None = None,
                       note: str | None = None,
                       stop_loss: float | None = None,
                       take_profit: float | None = None) -> tuple[bool, str | None]:
    """
    Boilerplate trade-signal email; values are supplied by the signal runner.
    """
    signal_type = signal_type.upper()
    is_buy = signal_type.lower() in ("long", "buy")
    accent = C_GREEN if is_buy else C_RED
    signal_color = C_GREEN if is_buy else C_RED
    action_word = "buy" if is_buy else "sell"

    subject = f"{BRAND} Signal: {signal_type} {ticker} — {strategy_name}"

    rows = [("<strong>Action</strong>", f'<span style="color:{signal_color};">{signal_type}</span>', C_TEXT)]
    if price is not None:
        rows.append(("Buy price" if is_buy else "Sell price", f"${price:,.2f}", C_TEXT))
    if stop_loss is not None:
        rows.append(("Stop loss", f"${stop_loss:,.2f}", C_RED))
    if take_profit is not None:
        rows.append(("Take profit", f"${take_profit:,.2f}", C_GREEN))
    if confidence is not None:
        rows.append(("Confidence", f"{confidence * 100:.0f}%", C_TEXT))

    note_html = (
        f'<p style="margin:16px 0 0;font-size:13px;color:{C_MUTED};">{note}</p>'
        if note else ""
    )

    inner = f"""{_greeting(user_name)}
<p style="margin:0 0 20px;">Your followed strategy <strong>{strategy_name}</strong> has generated a new {action_word} signal.</p>
{_panel("Signal Details", rows)}
{note_html}
<p style="margin:20px 0 0;">This signal is based on the strategy's historically backtested criteria. We encourage you to review the strategy's track record and do your own research before acting.</p>
{_btn("http://localhost:5173/#/strategies", "View strategy")}</a>"""

    return send_email(receiver, subject, _shell(f"{signal_type} {ticker} via {strategy_name}", "Trade Signal", accent, inner))


# -------- Signals Digest Email --------
def signals_digest_email(receiver: str, user_name: str,
                         signals: list[dict[str, Any]],
                         signal_date: str | None = None) -> tuple[bool, str | None]:
    """
    One email containing every signal generated for a user's followed
    strategies on a given trading day. `signals` entries:
      { strategy, ticker, signal_type, signal_date?, price?, confidence?,
        stop_loss?, take_profit? }
    Only LONG signals are generated today, but any type renders correctly.
    """
    if not signals:
        return False, "No signals — digest email skipped"

    date_str = f" for {signal_date}" if signal_date else ""
    n = len(signals)
    strategies = sorted({s.get("strategy", "Strategy") for s in signals})

    if n == 1:
        s = signals[0]
        subject = f"{BRAND} Signal: {s['signal_type']} {s['ticker']} — {s['strategy']}"
    else:
        strat_part = f" from {len(strategies)} strategies" if len(strategies) > 1 else ""
        subject = f"{BRAND}: {n} new signals{strat_part}"

    # One compact row per signal
    rows_html = ""
    for s in signals:
        sig = str(s.get("signal_type", "")).upper()
        is_buy = sig in ("LONG", "BUY")
        color = C_GREEN if is_buy else C_RED
        conf = s.get("confidence")
        conf_html = f" <span style='color:{C_MUTED};'>({conf * 100:.0f}%)</span>" if conf is not None else ""

        details = []
        if s.get("price") is not None:
            details.append(f"@ ${s['price']:,.2f}")
        if s.get("stop_loss") is not None:
            details.append(f"SL ${s['stop_loss']:,.2f}")
        if s.get("take_profit") is not None:
            details.append(f"TP ${s['take_profit']:,.2f}")
        detail_html = f"<span style='color:{C_MUTED};font-size:12px;'> · {' · '.join(details)}</span>" if details else ""

        rows_html += (
            f'<tr>'
            f'<td style="padding:10px 0;border-bottom:1px solid {C_BORDER};">'
            f'<span style="display:inline-block;background:{color};color:#ffffff;font-weight:700;'
            f'font-size:11px;padding:2px 8px;border-radius:6px;">{sig}</span>'
            f' <strong style="font-size:15px;margin-left:4px;">{s["ticker"]}</strong>{conf_html}'
            f'<br><span style="color:{C_MUTED};font-size:12px;">{s.get("strategy", "")}</span>'
            f'{detail_html}'
            f'</td>'
            f'</tr>'
        )

    signals_block = (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:{C_PANEL};border:1px solid {C_BORDER};border-radius:10px;padding:4px 16px;">'
        f'{rows_html}</table>'
    )

    intro = (
        "Your followed strategy spotted a new opportunity."
        if n == 1 else
        f"Your {len(strategies)} followed strategies finished today's run and spotted {n} opportunities."
    )

    inner = f"""{_greeting(user_name)}
<p style="margin:0 0 20px;">{intro}</p>
{signals_block}
<p style="margin:20px 0 0;">These signals come from each strategy's backtested criteria. Review the strategy's track record and do your own research before acting.</p>
{_btn("http://localhost:5173/#/strategies", "View strategies")}"""

    preheader = (
        f"{signals[0]['signal_type']} {signals[0]['ticker']}"
        if n == 1 else f"{n} new signals across your strategies"
    )
    return send_email(
        receiver, subject,
        _shell(preheader + date_str, "Trade Signals", C_ACCENT, inner),
    )


# -------- Security Warning Email --------
def security_warning_email(receiver: str, user_name: str, event: str,
                           ip_address: str | None = None,
                           device: str | None = None,
                           when: str | None = None) -> tuple[bool, str | None]:
    subject = f"{BRAND} Security Alert: {event}"

    rows = [("Event", event, C_TEXT)]
    if when:
        rows.append(("When", when, C_TEXT))
    if ip_address:
        rows.append(("IP address", ip_address, C_TEXT))
    if device:
        rows.append(("Device", device, C_TEXT))

    inner = f"""{_greeting(user_name)}
<p style="margin:0 0 20px;">We detected the following security event on your SLTP account.</p>
{_panel("Event Details", rows)}
<p style="margin:20px 0 0;"><strong>If this was you,</strong> no action is needed.</p>
<p style="margin:8px 0 0;">If you don't recognize this activity, secure your account immediately: change your password from Settings, review active sessions, and contact us at <a href="mailto:legal.sltp@gmail.com" style="color:{C_ACCENT};">legal.sltp@gmail.com</a> if you need assistance.</p>
{_btn("http://localhost:5173/#/settings", "Open Settings")}</a>"""

    return send_email(receiver, subject, _shell(event, "Security Alert", C_RED, inner))


# -------- Market Summary Email --------
def market_summary_email(receiver: str, user_name: str,
                         summary: dict[str, Any]) -> tuple[bool, str | None]:
    """
    Daily recap of the biggest moves across the universe. `summary` keys:
      mood: str            — one of the MOOD_* constants from market_summary.py
      headline: str        — the mood's headline sentence
      trading_date: str
      breadth_pct: float   — % of tickers that closed up
      gainers: list        — [{ticker, change_pct, close}] top movers up
      losers: list         — [{ticker, change_pct, close}] top movers down
      spotlight: dict      — {ticker, change_pct, close, note} biggest mover
      flat_note: str       — fallback text when data is thin (optional)
    """
    mood = summary.get("mood", "mixed")
    mood_config = {
        "risk_on": ("Market Summary", C_GREEN, "&#9650;"),
        "risk_off": ("Market Summary", C_RED, "&#9660;"),
        "mixed": ("Market Summary", C_ACCENT, "&#9660;"),
        "quiet": ("Market Summary", C_MUTED, "&#9650;"),
    }
    _, accent, _ = mood_config.get(mood, mood_config["mixed"])

    subject = f"{BRAND} Market Summary: {summary.get('headline', 'The day in review')}"
    parts: list[str] = [_greeting(user_name)]

    flat_note = summary.get("flat_note")
    if flat_note:
        parts.append(f'<p style="margin:0 0 16px;color:{C_MUTED};">{flat_note}</p>')
    else:
        # Mood headline
        parts.append(
            f'<div style="background:{C_PANEL};border:1px solid {C_BORDER};'
            f'border-left:4px solid {accent};border-radius:10px;padding:14px 16px;margin:0 0 20px;">'
            f'<strong style="font-size:16px;">{summary.get("headline", "")}</strong>'
            f'</div>'
        )

        # Breadth line
        breadth = summary.get("breadth_pct")
        if breadth is not None:
            b_color = C_GREEN if breadth >= 50 else C_RED
            parts.append(
                f'<p style="margin:0 0 16px;">Across the universe we track, '
                f'<strong style="color:{b_color};">{breadth:.0f}%</strong> of tickers closed higher.</p>'
            )

        # Movers tables
        def movers_table(label: str, movers: list[dict], color: str) -> str:
            if not movers:
                return ""
            rows = "".join(
                f'<tr>'
                f'<td style="padding:6px 0;font-weight:600;font-size:14px;">{m["ticker"]}</td>'
                f'<td style="padding:6px 0;text-align:right;color:{color};font-weight:600;">'
                f'{m["change_pct"]:+.2f}%</td>'
                f'<td style="padding:6px 0;text-align:right;color:{C_MUTED};font-size:13px;">'
                f'${m["close"]:,.2f}</td>'
                f'</tr>'
                for m in movers
            )
            return (
                f'<p style="margin:0 0 8px;color:{C_MUTED};font-size:11px;font-weight:700;'
                f'letter-spacing:0.1em;text-transform:uppercase;">{label}</p>'
                f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
                f'style="background:{C_PANEL};border:1px solid {C_BORDER};border-radius:10px;padding:8px 16px;margin:0 0 20px;">'
                f'{rows}</table>'
            )

        parts.append(movers_table("Biggest gainers", summary.get("gainers") or [], C_GREEN))
        parts.append(movers_table("Biggest decliners", summary.get("losers") or [], C_RED))

        # Spotlight on the single biggest mover
        spot = summary.get("spotlight")
        if spot:
            up = spot["change_pct"] >= 0
            s_color = C_GREEN if up else C_RED
            parts.append(
                f'<p style="margin:0 0 16px;">Spotlight: <strong>{spot["ticker"]}</strong> '
                f'<span style="color:{s_color};font-weight:600;">{spot["change_pct"]:+.2f}%</span> '
                f'to ${spot["close"]:,.2f} — the biggest move of the day. {spot.get("note", "")}</p>'
            )

    date_line = f"<p style=\"margin:0;color:{C_MUTED};font-size:12px;\">Trading session: {summary.get('trading_date', 'latest')}</p>"
    parts.append(date_line)

    inner = "".join(f'<div style="margin-bottom:4px;">{p}</div>' for p in parts)
    inner += _btn("http://localhost:5173/#/performance", "Open Performance")

    return send_email(
        receiver, subject,
        _shell(summary.get("headline", "The day in review"), "Market Summary", accent, inner),
    )


def daily_summary_email(receiver: str, user_name: str,
                        summary_data: dict[str, Any] | None = None) -> tuple[bool, str | None]:
    """
    Morning overview. `summary_data` keys rendered when present:
      market_overview: str          — your analysis text (fill in later)
      portfolio_value: float
      portfolio_change_pct: float   — vs yesterday, in percent
      watchlist_moves: list[dict]   — [{'ticker', 'change_pct'}]
      signals_today: list[dict]     — [{'strategy', 'ticker', 'signal_type'}]
    """
    subject = f"{BRAND} Daily Market Summary"
    data = summary_data or {}

    parts: list[str] = [_greeting(user_name), '<p style="margin:0 0 20px;">Here is your morning overview.</p>']

    overview = data.get("market_overview")
    overview_html = (
        f'<p style="margin:0;white-space:pre-line;">{overview}</p>'
        if overview else
        f'<p style="margin:0;color:{C_MUTED};">Today\'s full market analysis is being prepared — check back in the app for live charts.</p>'
    )
    parts.append(f'<p style="margin:0 0 8px;color:{C_MUTED};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Market Overview</p>'
                 f'<div style="background:{C_PANEL};border:1px solid {C_BORDER};border-radius:10px;padding:14px 16px;">{overview_html}</div>')

    pv = data.get("portfolio_value")
    if pv is not None:
        change = data.get("portfolio_change_pct")
        change_str = f" <span style='color:{C_GREEN if (change or 0) >= 0 else C_RED};'>({change:+.2f}% vs. yesterday)</span>" if change is not None else ""
        parts.append(_panel("Your Portfolio", [("Total value", f"${pv:,.2f}{change_str}", C_TEXT)]))

    moves = data.get("watchlist_moves") or []
    if moves:
        rows = [(m["ticker"], f"{m['change_pct']:+.2f}%",
                 C_GREEN if m["change_pct"] >= 0 else C_RED) for m in moves]
        parts.append(_panel("Watchlist Movements", rows))

    signals = data.get("signals_today") or []
    if signals:
        rows = [(f"{s['signal_type']} {s['ticker']}", s["strategy"], C_TEXT) for s in signals]
        parts.append(_panel("Today's Signals", rows))

    inner = "".join(f'<div style="margin-bottom:20px;">{p}</div>' for p in parts)
    inner += _btn("http://localhost:5173/#/performance", "Open Performance")

    return send_email(receiver, subject, _shell("Your morning market overview", "Daily Summary", C_ACCENT, inner))


# -------- Price Alert Email --------
def price_alert_email(receiver: str, user_name: str, ticker: str,
                      change_pct: float, current_price: float | None = None,
                      direction: str | None = None) -> tuple[bool, str | None]:
    """Alert when a tracked instrument moves +/- 5% within one session."""
    if direction is None:
        direction = "surge" if change_pct >= 0 else "decline"
    up = change_pct >= 0
    accent = C_GREEN if up else C_RED
    arrow = "&#9650;" if up else "&#9660;"

    subject = f"{BRAND} Price Alert: {ticker} {'▲' if up else '▼'} {abs(change_pct):.1f}% this session"

    rows = [
        ("Ticker", f"<strong>{ticker}</strong>", C_TEXT),
        ("Movement", f"<span style='color:{accent};'>{arrow} {change_pct:+.2f}%</span> ({direction})", C_TEXT),
    ]
    if current_price is not None:
        rows.append(("Current price", f"${current_price:,.2f}", C_TEXT))

    inner = f"""{_greeting(user_name)}
<p style="margin:0 0 20px;">A tracked instrument moved more than 5% within a single trading session.</p>
{_panel("Alert Details", rows)}
<p style="margin:20px 0 0;">Large single-session moves often accompany earnings announcements, sector news, or shifts in market sentiment. Review the latest price history before making any decisions.</p>
{_btn("http://localhost:5173/#/performance", "View chart")}</a>"""

    return send_email(receiver, subject, _shell(f"{ticker} {change_pct:+.1f}%", "Price Alert", accent, inner))


# -------- Dispatch Helper --------
def send_notification_email(kind: str, receiver: str, user_name: str,
                            payload: dict[str, Any] | None = None) -> tuple[bool, str | None]:
    """kind: trade_signal | signals_digest | security_warning | daily_summary |
    market_summary | price_alert."""
    p = payload or {}
    if kind == "trade_signal":
        return trade_signal_email(
            receiver, user_name, p.get("strategy_name", "Unknown strategy"),
            p.get("ticker", "?"), p.get("signal_type", "?"),
            p.get("price"), p.get("confidence"), p.get("note"),
            p.get("stop_loss"), p.get("take_profit"),
        )
    if kind == "signals_digest":
        return signals_digest_email(
            receiver, user_name, p.get("signals", []), p.get("signal_date"),
        )
    if kind == "market_summary":
        return market_summary_email(receiver, user_name, p.get("summary", {}))
    if kind == "security_warning":
        return security_warning_email(
            receiver, user_name, p.get("event", "Account activity detected"),
            p.get("ip_address"), p.get("device"), p.get("when"),
        )
    if kind == "daily_summary":
        return daily_summary_email(receiver, user_name, p.get("summary_data"))
    if kind == "price_alert":
        return price_alert_email(
            receiver, user_name, p.get("ticker", "?"),
            p.get("change_pct", 0.0), p.get("current_price"), p.get("direction"),
        )
    return False, f"Unknown notification kind: {kind}"
