import io
import magic
import fitz  # pymupdf
from oletools.olevba import VBA_Parser, TYPE_OLE, TYPE_OpenXML
from models.analysis import AttachmentAnalysis, RiskLevel

# Extensions Office susceptibles de contenir des macros
_MACRO_EXTS = {'.doc', '.dot', '.xls', '.xlt', '.ppt', '.pps',
               '.docm', '.xlsm', '.pptm', '.dotm', '.xltm'}

# Correspondance extension → MIME attendu (liste non exhaustive mais couvre l'essentiel)
_EXT_MIME: dict[str, set[str]] = {
    '.pdf':  {'application/pdf'},
    '.png':  {'image/png'},
    '.jpg':  {'image/jpeg'},
    '.jpeg': {'image/jpeg'},
    '.gif':  {'image/gif'},
    '.zip':  {'application/zip'},
    '.docx': {'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/zip'},
    '.xlsx': {'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/zip'},
    '.pptx': {'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'application/zip'},
    '.doc':  {'application/msword', 'application/x-ole-storage'},
    '.xls':  {'application/vnd.ms-excel', 'application/x-ole-storage'},
    '.ppt':  {'application/vnd.ms-powerpoint', 'application/x-ole-storage'},
    '.exe':  {'application/x-dosexec', 'application/x-executable'},
    '.js':   {'text/javascript', 'application/javascript'},
    '.vbs':  {'text/x-vbscript'},
    '.ps1':  {'text/x-powershell'},
    '.html': {'text/html'},
    '.xml':  {'text/xml', 'application/xml'},
}

# Extensions intrinsèquement dangereuses
_DANGEROUS_EXTS = {'.exe', '.bat', '.cmd', '.com', '.scr', '.pif',
                   '.vbs', '.vbe', '.js', '.jse', '.ps1', '.ps2',
                   '.msi', '.dll', '.hta', '.wsf', '.wsh'}


def _real_mime(raw: bytes) -> str:
    return magic.from_buffer(raw[:4096], mime=True)


def _check_macros(filename: str, raw: bytes) -> tuple[bool, list[str]]:
    try:
        vba = VBA_Parser(filename, data=raw)
        if vba.type not in (TYPE_OLE, TYPE_OpenXML):
            return False, []
        if not vba.detect_vba_macros():
            return False, []
        details = []
        for _, _, vba_code in vba.extract_macros():
            if vba_code:
                # On relève les appels suspects courants
                for kw in ('Shell', 'CreateObject', 'WScript', 'PowerShell',
                           'AutoOpen', 'Auto_Open', 'Document_Open', 'Workbook_Open'):
                    if kw.lower() in vba_code.lower():
                        details.append(kw)
        return True, list(set(details))
    except Exception:
        return False, []


def _check_pdf_js(raw: bytes) -> bool:
    try:
        doc = fitz.open(stream=raw, filetype="pdf")
        for i in range(len(doc)):
            page = doc[i]
            # Cherche les actions JavaScript dans les annotations
            for annot in page.annots():
                if annot.info.get("action") and "javascript" in str(annot.info).lower():
                    return True
        # Cherche dans le catalogue du document
        catalog = doc.pdf_catalog()
        if catalog:
            for key in ("AA", "OpenAction", "JavaScript"):
                if key in str(doc.xref_object(catalog)):
                    return True
        return False
    except Exception:
        return False


def _double_extension(filename: str) -> bool:
    """Détecte facture.pdf.exe, document.docx.js, etc."""
    parts = filename.lower().split('.')
    if len(parts) < 3:
        return False
    last = f".{parts[-1]}"
    second_last = f".{parts[-2]}"
    # Suspect si la dernière extension est dangereuse
    # et l'avant-dernière ressemble à un type légitime
    legit = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png', '.txt'}
    return last in _DANGEROUS_EXTS and second_last in legit


def analyze_attachment(filename: str, declared_mime: str, raw: bytes) -> AttachmentAnalysis:
    ext = ('.' + filename.rsplit('.', 1)[-1]).lower() if '.' in filename else ''
    real_mime = _real_mime(raw)

    # Mismatch : le vrai type ne correspond pas à l'extension déclarée
    expected = _EXT_MIME.get(ext, set())
    mime_mismatch = bool(expected and real_mime not in expected)

    # Macros OLE
    has_macros, macro_details = (False, [])
    if ext in _MACRO_EXTS:
        has_macros, macro_details = _check_macros(filename, raw)

    # JavaScript dans PDF
    has_js_in_pdf = False
    if ext == '.pdf' or real_mime == 'application/pdf':
        has_js_in_pdf = _check_pdf_js(raw)

    double_ext = _double_extension(filename)

    # Calcul du risque
    reasons: list[str] = []

    if ext in _DANGEROUS_EXTS:
        reasons.append(f"Extension exécutable dangereuse : {ext}")
    if mime_mismatch:
        reasons.append(f"Type réel ({real_mime}) ne correspond pas à l'extension ({ext})")
    if has_macros:
        reasons.append("Macros VBA détectées")
        if macro_details:
            reasons.append(f"Appels suspects : {', '.join(macro_details)}")
    if has_js_in_pdf:
        reasons.append("JavaScript embarqué dans le PDF")
    if double_ext:
        reasons.append(f"Double extension suspecte : {filename}")

    if ext in _DANGEROUS_EXTS or (has_macros and macro_details) or has_js_in_pdf or mime_mismatch:
        risk = RiskLevel.DANGEROUS
    elif has_macros or double_ext:
        risk = RiskLevel.SUSPICIOUS
    else:
        risk = RiskLevel.SAFE

    return AttachmentAnalysis(
        filename=filename,
        declared_mime=declared_mime,
        real_mime=real_mime,
        extension=ext,
        size=len(raw),
        mime_mismatch=mime_mismatch,
        has_macros=has_macros,
        macro_details=macro_details,
        has_js_in_pdf=has_js_in_pdf,
        double_extension=double_ext,
        risk=risk,
        risk_reasons=reasons,
    )
