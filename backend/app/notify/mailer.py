# -------- mailer.py --------
# SLTP notification emails (HTML, mobile-friendly).
#
# The ONLY notification surface. No daily runner, no scheduled sends live in
# this codebase — every function below just builds and sends one email, and
# callers decide when. The operator report script is the only automated caller.
#
# Layout uses inline styles and table markup so it renders correctly in Gmail,
# Outlook and mobile mail clients.
#
# USAGE: python -m app.notify.mailer <to> <kind> [user_name]
#   kinds: security | signal | ops

# -------- Imports --------
import os
import smtplib
import sys

from typing import Any

from dotenv import load_dotenv
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

load_dotenv()


# -------- Brand & Palette --------
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

# Ops emails go to the operator, so they must not claim the reader is a customer.
OPS_FOOTER_HTML = (
    '<p style="margin:24px 0 0;color:#968f88;font-size:12px;line-height:1.5;'
    'border-top:1px solid #e6e0d4;padding-top:16px;">'
    "Internal SLTP report, sent only to the operator address."
    "</p>"
)


# -------- Admin Recipient --------
# Ops mail goes to ADMIN_EMAIL when set, otherwise to SENDER_EMAIL. The Gmail
# account that authenticates the send is the one address we know exists, so an
# unconfigured install mails itself instead of dropping the report.
def admin_recipient() -> str | None:
    for name in ("ADMIN_EMAIL", "SENDER_EMAIL"):
        value = (os.environ.get(name) or "").strip()
        if value:
            return value
    return None


# -------- Low-Level Sender --------
# Send an HTML email over Gmail SMTP; returns (success, error_message).
def send_email(receiver: str, subject: str, html: str) -> tuple[bool, str | None]:
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
# Wrap content in the common branded frame; tables keep the layout email-safe.
def _shell(preheader: str, title: str, accent: str, inner_html: str,
           footer_html: str = FOOTER_HTML) -> str:
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
        {footer_html}
      </td>
    </tr>
  </table>
  <p style="color:#b0a99f;font-size:11px;margin:16px 0 0;">&copy; {BRAND} &mdash; research-first market analysis</p>
</td></tr>
</table>
</body>
</html>"""


# The opening line every email shares.
def _greeting(user_name: str) -> str:
    return f'<p style="margin:0 0 16px;">Hello <strong>{user_name}</strong>,</p>'


# A labelled key-value panel; rows is [(label, value, value_color), ...].
def _panel(label: str, rows: list[tuple[str, str, str]]) -> str:
    trs: str = "".join(
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


# The call-to-action button.
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
    # Boilerplate trade-signal email; values are supplied by the signal caller.
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
<p style="margin:20px 0 0;">This signal is based on the strategy's historically backtested criteria. We encourage you to review the strategy's track record and do your own research before acting.</p>"""

    return send_email(receiver, subject, _shell(f"{signal_type} {ticker} via {strategy_name}", "Trade Signal", accent, inner))


# -------- Signals Digest Email --------
def signals_digest_email(receiver: str, user_name: str,
                         signals: list[dict[str, Any]],
                         signal_date: str | None = None) -> tuple[bool, str | None]:
    # One email with every signal for a user's followed strategies on a given
    # trading day. Each entry is { strategy, ticker, signal_type, signal_date?,
    # price?, confidence?, stop_loss?, take_profit? }.
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
<p style="margin:20px 0 0;">These signals come from each strategy's backtested criteria. Review the strategy's track record and do your own research before acting.</p>"""

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
<p style="margin:8px 0 0;">If you don't recognize this activity, secure your account immediately: change your password from Settings and contact us if you need assistance.</p>"""

    return send_email(receiver, subject, _shell(event, "Security Alert", C_RED, inner))


# -------- Price Alert Email --------
def price_alert_email(receiver: str, user_name: str, ticker: str,
                      change_pct: float, current_price: float | None = None,
                      direction: str | None = None) -> tuple[bool, str | None]:
    # Alert when a tracked instrument moves sharply within one session.
    if direction is None:
        direction = "surge" if change_pct >= 0 else "decline"
    up = change_pct >= 0
    accent = C_GREEN if up else C_RED
    arrow = "&#9650;" if up else "&#9660;"

    subject = f"{BRAND} Price Alert: {ticker} {'▲' if up else '▼'} {abs(change_pct):.1f}% this session"

    rows = [("Movement", f"{arrow} {abs(change_pct):.1f}% {direction}", accent)]
    if current_price is not None:
        rows.append(("Current price", f"${current_price:,.2f}", C_TEXT))

    inner = f"""{_greeting(user_name)}
<p style="margin:0 0 20px;"><strong>{ticker}</strong> moved {abs(change_pct):.1f}% this session.</p>
{_panel("Alert Details", rows)}
<p style="margin:20px 0 0;">This is an automated notice based on your price-alert settings. Review the chart and do your own research before acting.</p>"""

    return send_email(receiver, subject, _shell(f"{ticker} {direction}", "Price Alert", accent, inner))


# -------- Operator Report Email --------
def ops_report_email(receiver: str, report: dict[str, Any]) -> tuple[bool, str | None]:
    # The daily operator brief: signups, activity, onboarding, churn. The only
    # automated email left in the system; sent by scripts/operator_report.py.
    date_str = report.get("date", "")
    subject = f"{BRAND} operator brief — {date_str}"

    accounts = report.get("accounts", {})
    usage = report.get("usage", {})
    deletions = report.get("deletions", {})

    def val(v: Any) -> str:
        return str(v) if v is not None else "unknown"

    inner = f"""<p style="margin:0 0 20px;">State of the user base for <strong>{date_str}</strong>.</p>
{_panel("Accounts (Supabase auth)", [
    ("Total accounts", val(accounts.get("total")), C_TEXT),
    ("New in 7 days", val(accounts.get("new_7d")), C_TEXT),
    ("New in 30 days", val(accounts.get("new_30d")), C_TEXT),
    ("Never signed in", val(accounts.get("never_signed_in")), C_TEXT),
    ("Active in 7 days", val(accounts.get("active_7d")), C_TEXT),
    ("Active in 30 days", val(accounts.get("active_30d")), C_TEXT),
])}
<div style="margin-top:20px;">{_panel("Usage (app tables)", [
    ("Profiles", val(usage.get("profiles")), C_TEXT),
    ("Onboarded", val(usage.get("onboarded")), C_TEXT),
    ("Active API keys", val(usage.get("api_keys")), C_TEXT),
    ("Deletions logged", val(usage.get("deletions")), C_TEXT),
])}</div>
<div style="margin-top:20px;">{_panel("Churn", [
    ("Deleted in 30 days", val(deletions.get("recent_30d")), C_TEXT),
    ("Total deleted", val(deletions.get("total")), C_TEXT),
])}</div>"""

    followed = report.get("followed_strategies") or []
    if followed:
        rows = [(sid, str(n), C_TEXT) for sid, n in followed]
        inner += f'<div style="margin-top:20px;">{_panel("Followed strategies", rows)}</div>'

    return send_email(receiver, subject, _shell(
        f"Operator brief for {date_str}", "Operator brief", C_ACCENT, inner,
        footer_html=OPS_FOOTER_HTML,
    ))


# -------- Manual Sends --------
# python -m app.notify.mailer <to> <kind> [user_name]
if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: python -m app.notify.mailer <to> <kind> [user_name]")
        print("kinds: security | signal | ops")
        raise SystemExit(2)
    to, kind = sys.argv[1], sys.argv[2]
    name = sys.argv[3] if len(sys.argv) > 3 else to
    if kind == "security":
        ok, err = security_warning_email(to, name, "Test security event", device="Test device")
    elif kind == "signal":
        ok, err = trade_signal_email(to, name, "Buy and Hold", "SPY", "BUY", 500.0)
    elif kind == "ops":
        ok, err = ops_report_email(to, {"date": "test", "accounts": {}, "usage": {}, "deletions": {}})
    else:
        print(f"unknown kind: {kind}")
        raise SystemExit(2)
    print("sent" if ok else f"FAILED: {err}")
