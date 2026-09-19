import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv

load_dotenv()


def send_email(receiver: str, subject: str, body: str) -> tuple[bool, str | None]:
    """
    Sends an email via Gmail SMTP.
    Returns (success, error_message) so callers (e.g. the outbox) can track failures.
    """
    sender_email = os.environ.get("SENDER_EMAIL")
    app_password = os.environ.get("APP_PASSWORD")

    if not sender_email or not app_password:
        return False, "Missing SENDER_EMAIL or APP_PASSWORD in .env"

    message = MIMEMultipart()
    message["From"] = sender_email
    message["To"] = receiver
    message["Subject"] = subject
    message.attach(MIMEText(body, "plain"))

    try:
        # Connect to Gmail's SMTP server via TLS (Port 587)
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()  # Secure the connection
            server.login(sender_email, app_password)
            server.sendmail(sender_email, receiver, message.as_string())
        return True, None
    except Exception as e:
        return False, str(e)


if __name__ == "__main__":
    # CLI test: python -m app.notification.email <to> <subject> <body>
    import sys

    if len(sys.argv) < 4:
        print("Usage: python -m app.notification.email <to> <subject> <body>")
        sys.exit(1)

    ok, error = send_email(sys.argv[1], sys.argv[2], sys.argv[3])
    if ok:
        print("Email sent successfully.")
    else:
        print(f"Email failed: {error}")
        sys.exit(1)
