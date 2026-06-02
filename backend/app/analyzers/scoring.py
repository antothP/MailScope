from models.analysis import HeaderAnalysis, AttachmentAnalysis


class ScoreResult:
    def __init__(self):
        self.score: int = 0
        self.level: str = "safe"       # safe / suspicious / dangerous
        self.reasons: list[str] = []

    def add(self, points: int, reason: str):
        self.score = min(100, self.score + points)
        self.reasons.append(reason)

    def finalize(self):
        if self.score >= 61:
            self.level = "dangerous"
        elif self.score >= 31:
            self.level = "suspicious"
        else:
            self.level = "safe"
        return self


def compute_score(
    header_analysis: HeaderAnalysis,
    attachment_analyses: list[AttachmentAnalysis],
) -> ScoreResult:
    r = ScoreResult()

    # ── Authentification ──────────────────────────────────────────────────────

    if not header_analysis.spf.present:
        r.add(10, "SPF absent")
    elif header_analysis.spf.pass_ is False:
        r.add(15, "SPF échoué")

    if not header_analysis.dkim.present:
        r.add(10, "DKIM absent")
    elif header_analysis.dkim.pass_ is False:
        r.add(15, "DKIM échoué")

    if not header_analysis.dmarc.present:
        r.add(10, "DMARC absent")
    elif header_analysis.dmarc.pass_ is False:
        r.add(15, "DMARC échoué")

    # ── Identité ──────────────────────────────────────────────────────────────

    if not header_analysis.message_id:
        r.add(10, "Message-ID absent")

    if header_analysis.reply_to and header_analysis.reply_to.differs_from_sender:
        r.add(20, "Reply-To pointe vers un domaine différent de l'expéditeur")

    # ── Pièces jointes ────────────────────────────────────────────────────────

    for a in attachment_analyses:
        if a.risk == "dangerous":
            r.add(35, f"Pièce jointe dangereuse : {a.filename}")
        elif a.risk == "suspicious":
            r.add(15, f"Pièce jointe suspecte : {a.filename}")

        if a.mime_mismatch:
            r.add(25, f"Type réel ({a.real_mime}) ≠ extension déclarée ({a.extension}) pour {a.filename}")

        if a.has_macros:
            pts = 25 if a.macro_details else 15
            detail = f" ({', '.join(a.macro_details)})" if a.macro_details else ""
            r.add(pts, f"Macros VBA{detail} dans {a.filename}")

        if a.has_js_in_pdf:
            r.add(25, f"JavaScript embarqué dans le PDF {a.filename}")

        if a.double_extension:
            r.add(20, f"Double extension suspecte : {a.filename}")

    # ── Flags suspects du header ──────────────────────────────────────────────

    # On évite de double-compter ce qui est déjà au-dessus
    already = {"SPF", "DKIM", "DMARC", "Message-ID", "Reply-To"}
    for flag in header_analysis.suspicious_flags:
        if not any(k in flag for k in already):
            r.add(10, flag)

    return r.finalize()
