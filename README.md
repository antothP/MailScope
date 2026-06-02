# MailScope

Analyseur d'emails suspects orienté détection de phishing. L'utilisateur exporte manuellement un email suspect depuis son client mail (Outlook, Gmail, Thunderbird...) au format `.eml`, le dépose via drag and drop sur l'interface, et obtient un rapport complet sur le niveau de dangerosité du message analysé.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Backend | Python 3.12 + FastAPI |
| Analyse fichiers | python-magic, oletools, pymupdf |
| Frontend | React + TypeScript + Vite |
| Styles | Tailwind CSS |
| Export | jsPDF (génération PDF côté client) |

---

## Architecture du projet

```
mailscope/
├── backend/
│   ├── app/
│   │   ├── main.py                  # Point d'entrée FastAPI, CORS, routes
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── routes.py            # POST /api/analyze
│   │   ├── parsers/
│   │   │   ├── __init__.py
│   │   │   └── eml_parser.py        # Parsing .eml → headers, body, pièces jointes
│   │   ├── analyzers/
│   │   │   ├── __init__.py
│   │   │   ├── attachment.py        # Magic bytes, macros VBA, JS dans PDF, double extension
│   │   │   ├── headers.py           # SPF, DKIM, DMARC, Reply-To, hops SMTP
│   │   │   └── scoring.py           # Score de risque global 0-100
│   │   └── models/
│   │       ├── __init__.py
│   │       └── analysis.py          # Modèles Pydantic
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── index.css                # Variables CSS thème beige + Tailwind
│   │   ├── components/
│   │   │   ├── DropZone.tsx         # Zone drag and drop fichier .eml
│   │   │   └── ScoreCard.tsx        # Score + authentification + pièces jointes
│   │   ├── pages/
│   │   │   └── Dashboard.tsx        # Page principale (accueil + résultats 4 onglets)
│   │   ├── hooks/
│   │   │   └── useExportPdf.ts      # Génération rapport PDF avec jsPDF
│   │   ├── api/
│   │   │   └── client.ts            # Appels fetch vers le backend
│   │   └── types/
│   │       └── analysis.ts          # Types TypeScript
│   ├── vite.config.ts               # Proxy /api → localhost:8000
│   └── package.json
├── test_emails/                     # Emails de test générés
│   ├── 01_phishing_reply_to.eml
│   ├── 02_double_extension_exe.eml
│   ├── 03_macro_spf_fail.eml
│   ├── 04_pdf_with_js.eml
│   └── 05_exe_as_jpg.eml
└── generate_test_emails.py          # Script de génération des emails de test
```

---

## Lancer le projet

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows : .venv\Scripts\activate
pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Accessible sur http://localhost:5173
```

Le proxy Vite redirige automatiquement `/api/*` vers `http://localhost:8000`.

---

## Générer les emails de test

```bash
python3 generate_test_emails.py
```

| Fichier | Menace simulée | Score attendu |
|---|---|---|
| `01_phishing_reply_to.eml` | Reply-To suspect + IP malveillante | ~40-50 Suspect |
| `02_double_extension_exe.eml` | EXE déguisé en PDF (double extension) | ~70-90 Dangereux |
| `03_macro_spf_fail.eml` | Macros VBA + SPF/DKIM/DMARC fail | ~80-100 Dangereux |
| `04_pdf_with_js.eml` | JavaScript embarqué dans PDF | ~60-80 Dangereux |
| `05_exe_as_jpg.eml` | Exécutable MZ déguisé en image .jpg | ~60-80 Dangereux |

---

## Ce que l'outil analyse

### Headers SMTP
- SPF, DKIM, DMARC (pass / fail / absent)
- Reply-To différent de l'expéditeur
- Chemin de relais SMTP (Received hops)
- IP d'origine (`X-Originating-IP`)
- Flags suspects (`X-Mailer`, headers inhabituels)

### Pièces jointes
- **Magic bytes** : vrai type MIME détecté vs extension déclarée
- **Macros VBA** : détection via oletools (`AutoOpen`, `Shell`, `CreateObject`, etc.)
- **JavaScript dans PDF** : détection via pymupdf (`/OpenAction`, `/AA`, `/JavaScript`)
- **Double extension** : ex. `facture.pdf.exe`
- **SHA256** + liens directs VirusTotal et MalwareBazaar (sans clé API)

### Score global (0-100)

| Signal | Points |
|---|---|
| SPF / DKIM / DMARC absent | +10 chacun |
| SPF / DKIM / DMARC fail | +15 chacun |
| Reply-To différent | +20 |
| Magic bytes mismatch | +30 |
| Macros VBA avec AutoOpen | +25 |
| JavaScript dans PDF | +20 |
| Double extension | +15 |
| Extension exécutable | +30 |

Niveaux : **Sûr** (0-30) · **Suspect** (31-60) · **Dangereux** (61-100)

### Export PDF
Rapport généré côté client avec jsPDF : score, authentification, informations email, pièces jointes avec hash et indicateurs, chemin réseau SMTP.

---

## Ce qui n'est pas encore implémenté

- Analyse des liens (VirusTotal API, Google Safe Browsing)
- Tests automatisés backend
