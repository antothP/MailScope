import re
from email.utils import parseaddr
from models.analysis import (
    HeaderAnalysis, AuthResult, ReceivedHop, ReplyToAnalysis
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _domain(address: str) -> str:
    """Extrait le domaine d'une adresse email."""
    _, addr = parseaddr(address)
    return addr.split("@")[-1].lower().strip() if "@" in addr else ""


def _first(headers: dict[str, str], *keys: str) -> str | None:
    for k in keys:
        v = headers.get(k) or headers.get(k.lower())
        if v:
            return v.strip()
    return None


# ── SPF ──────────────────────────────────────────────────────────────────────

def _parse_spf(headers: dict[str, str]) -> AuthResult:
    """
    SPF se lit dans Authentication-Results ou Received-SPF.
    Exemples :
      Authentication-Results: mx.google.com; spf=pass (...)
      Received-SPF: pass (google.com: ...)
    """
    raw = _first(headers, "Authentication-Results", "authentication-results")
    if raw:
        m = re.search(r"\bspf=(\w+)", raw, re.IGNORECASE)
        if m:
            verdict = m.group(1).lower()
            return AuthResult(present=True, pass_=(verdict == "pass"), raw=raw)

    raw_spf = _first(headers, "Received-SPF", "received-spf")
    if raw_spf:
        verdict = raw_spf.split()[0].lower() if raw_spf else ""
        return AuthResult(present=True, pass_=(verdict == "pass"), raw=raw_spf)

    return AuthResult(present=False)


# ── DKIM ─────────────────────────────────────────────────────────────────────

def _parse_dkim(headers: dict[str, str]) -> AuthResult:
    """
    DKIM se lit dans Authentication-Results ou DKIM-Signature (présence uniquement).
    Exemples :
      Authentication-Results: mx.google.com; dkim=pass header.i=@example.com
    """
    raw = _first(headers, "Authentication-Results", "authentication-results")
    if raw:
        m = re.search(r"\bdkim=(\w+)", raw, re.IGNORECASE)
        if m:
            verdict = m.group(1).lower()
            return AuthResult(present=True, pass_=(verdict == "pass"), raw=raw)

    # Signature présente mais résultat non disponible
    sig = _first(headers, "DKIM-Signature", "dkim-signature")
    if sig:
        return AuthResult(present=True, pass_=None, raw=sig)

    return AuthResult(present=False)


# ── DMARC ────────────────────────────────────────────────────────────────────

def _parse_dmarc(headers: dict[str, str]) -> AuthResult:
    """
    DMARC se lit dans Authentication-Results.
    Exemple :
      Authentication-Results: mx.google.com; dmarc=pass (p=REJECT) header.from=example.com
    """
    raw = _first(headers, "Authentication-Results", "authentication-results")
    if raw:
        m = re.search(r"\bdmarc=(\w+)", raw, re.IGNORECASE)
        if m:
            verdict = m.group(1).lower()
            return AuthResult(present=True, pass_=(verdict == "pass"), raw=raw)

    return AuthResult(present=False)


# ── Received hops ────────────────────────────────────────────────────────────

def _parse_received(headers: dict[str, str]) -> list[ReceivedHop]:
    """
    Il peut y avoir plusieurs headers Received (un par serveur traversé).
    email.message les fusionne avec '\n' si on les récupère via msg.get_all().
    Ici on travaille sur le dict brut, donc on split sur les occurrences.
    """
    raw_all = headers.get("Received") or headers.get("received") or ""
    if not raw_all:
        return []

    # Plusieurs Received peuvent être concaténés avec '\n' selon le parseur
    blocks = [b.strip() for b in re.split(r"\n(?=from\s|by\s)", raw_all, flags=re.IGNORECASE) if b.strip()]
    if not blocks:
        blocks = [raw_all]

    hops = []
    for block in blocks:
        from_match = re.search(r"from\s+(\S+)", block, re.IGNORECASE)
        by_match   = re.search(r"by\s+(\S+)",   block, re.IGNORECASE)
        # Timestamp après le point-virgule final
        ts_match   = re.search(r";\s*(.+)$",     block, re.IGNORECASE | re.MULTILINE)
        hops.append(ReceivedHop(
            raw=block,
            from_=from_match.group(1) if from_match else None,
            by=by_match.group(1) if by_match else None,
            timestamp=ts_match.group(1).strip() if ts_match else None,
        ))
    return hops


# ── Reply-To ─────────────────────────────────────────────────────────────────

def _parse_reply_to(headers: dict[str, str], sender: str | None) -> ReplyToAnalysis | None:
    raw = _first(headers, "Reply-To", "reply-to")
    if not raw:
        return None
    _, addr = parseaddr(raw)
    sender_domain  = _domain(sender or "")
    reply_domain   = _domain(addr)
    differs = bool(sender_domain and reply_domain and sender_domain != reply_domain)
    return ReplyToAnalysis(address=addr or raw, differs_from_sender=differs)


# ── Flags suspects ───────────────────────────────────────────────────────────

def _suspicious_flags(
    headers: dict[str, str],
    spf: AuthResult,
    dkim: AuthResult,
    dmarc: AuthResult,
    reply_to: ReplyToAnalysis | None,
    sender: str | None,
) -> list[str]:
    flags: list[str] = []

    if spf.present and spf.pass_ is False:
        flags.append("SPF échoué")
    if not spf.present:
        flags.append("SPF absent")

    if dkim.present and dkim.pass_ is False:
        flags.append("DKIM échoué")
    if not dkim.present:
        flags.append("DKIM absent")

    if dmarc.present and dmarc.pass_ is False:
        flags.append("DMARC échoué")
    if not dmarc.present:
        flags.append("DMARC absent")

    if reply_to and reply_to.differs_from_sender:
        flags.append(f"Reply-To différent de l'expéditeur ({reply_to.address})")

    # Message-ID manquant ou malformé
    mid = _first(headers, "Message-ID", "message-id")
    if not mid:
        flags.append("Message-ID absent")
    elif not re.search(r"<.+@.+>", mid):
        flags.append("Message-ID malformé")

    # Expéditeur avec domaine suspect (chiffres aléatoires)
    if sender:
        domain = _domain(sender)
        if re.search(r"\d{5,}", domain):
            flags.append(f"Domaine expéditeur suspect : {domain}")

    # X-Mailer inhabituel
    mailer = _first(headers, "X-Mailer", "x-mailer")
    if mailer and re.search(r"(bulk|mass|blast|phpmailer|sendgrid)", mailer, re.IGNORECASE):
        flags.append(f"X-Mailer suspect : {mailer}")

    return flags


# ── Point d'entrée ───────────────────────────────────────────────────────────

def analyze_headers(headers: dict[str, str], sender: str | None = None) -> HeaderAnalysis:
    spf   = _parse_spf(headers)
    dkim  = _parse_dkim(headers)
    dmarc = _parse_dmarc(headers)
    reply_to = _parse_reply_to(headers, sender)

    return HeaderAnalysis(
        spf=spf,
        dkim=dkim,
        dmarc=dmarc,
        message_id=_first(headers, "Message-ID", "message-id"),
        return_path=_first(headers, "Return-Path", "return-path"),
        reply_to=reply_to,
        received_hops=_parse_received(headers),
        x_originating_ip=_first(headers, "X-Originating-IP", "x-originating-ip"),
        suspicious_flags=_suspicious_flags(headers, spf, dkim, dmarc, reply_to, sender),
    )
