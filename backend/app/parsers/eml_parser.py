import email
from email import policy
from email.message import EmailMessage
from models.analysis import ParsedEmail, Attachment


def parse_eml(raw_bytes: bytes) -> tuple[ParsedEmail, list[tuple[str, str, bytes]]]:
    """
    Retourne (ParsedEmail, raw_attachments).
    raw_attachments : liste de (filename, content_type, raw_bytes)
    """
    msg: EmailMessage = email.message_from_bytes(raw_bytes, policy=policy.default)

    headers = {k: v for k, v in msg.items()}

    recipients = []
    for field in ("To", "Cc", "Bcc"):
        value = msg.get(field)
        if value:
            recipients.extend([addr.strip() for addr in value.split(",")])

    body_text = None
    body_html = None
    attachments = []
    raw_attachments: list[tuple[str, str, bytes]] = []

    for part in msg.walk():
        ct = part.get_content_type()
        cd = part.get_content_disposition()

        if cd == "attachment":
            payload = part.get_payload(decode=True) or b""
            filename = part.get_filename() or "unknown"
            attachments.append(Attachment(
                filename=filename,
                content_type=ct,
                size=len(payload),
            ))
            raw_attachments.append((filename, ct, payload))
        elif ct == "text/plain" and body_text is None:
            body_text = part.get_payload(decode=True).decode(
                part.get_content_charset() or "utf-8", errors="replace"
            )
        elif ct == "text/html" and body_html is None:
            body_html = part.get_payload(decode=True).decode(
                part.get_content_charset() or "utf-8", errors="replace"
            )

    parsed = ParsedEmail(
        subject=msg.get("Subject"),
        sender=msg.get("From"),
        recipients=recipients,
        date=msg.get("Date"),
        body_text=body_text,
        body_html=body_html,
        attachments=attachments,
        headers=headers,
    )
    return parsed, raw_attachments
