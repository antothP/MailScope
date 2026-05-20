from pydantic import BaseModel
from typing import Optional


class Attachment(BaseModel):
    filename: str
    content_type: str
    size: int


class ParsedEmail(BaseModel):
    subject: Optional[str]
    sender: Optional[str]
    recipients: list[str]
    date: Optional[str]
    body_text: Optional[str]
    body_html: Optional[str]
    attachments: list[Attachment]
    headers: dict[str, str]
