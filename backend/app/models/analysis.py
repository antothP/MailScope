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


# ── Résultats d'analyse des headers ──

class AuthResult(BaseModel):
    present: bool
    pass_: Optional[bool] = None   # None = inconnu / non parseable
    raw: Optional[str] = None      # valeur brute du header

class ReceivedHop(BaseModel):
    raw: str
    from_: Optional[str] = None
    by: Optional[str] = None
    timestamp: Optional[str] = None

class ReplyToAnalysis(BaseModel):
    address: Optional[str]
    differs_from_sender: bool

class HeaderAnalysis(BaseModel):
    # Authentification
    spf:   AuthResult
    dkim:  AuthResult
    dmarc: AuthResult

    # Identité
    message_id:    Optional[str]
    return_path:   Optional[str]
    reply_to:      Optional[ReplyToAnalysis]

    # Routage
    received_hops: list[ReceivedHop]
    x_originating_ip: Optional[str]

    # Indicateurs suspects
    suspicious_flags: list[str]


# ── Résultats d'analyse des pièces jointes ──

class RiskLevel(str):
    SAFE      = "safe"
    SUSPICIOUS = "suspicious"
    DANGEROUS = "dangerous"

class AttachmentAnalysis(BaseModel):
    filename: str
    declared_mime: str          # ce que l'email dit
    real_mime: str              # ce que magic bytes dit
    extension: str
    size: int
    mime_mismatch: bool         # vrai type ≠ extension
    has_macros: bool            # macros OLE détectées
    macro_details: list[str]    # noms des macros suspectes
    has_js_in_pdf: bool         # JS dans un PDF
    double_extension: bool      # ex: facture.pdf.exe
    risk: str                   # safe / suspicious / dangerous
    risk_reasons: list[str]


# ── Score global ──

class ScoreResult(BaseModel):
    score: int
    level: str          # safe / suspicious / dangerous
    reasons: list[str]
