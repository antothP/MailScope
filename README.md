# MailScope

Analyseur d'emails suspects orienté détection de phishing. L'utilisateur exporte manuellement un email suspect depuis son client mail (Outlook, Gmail, Thunderbird...) au format `.eml`, le dépose via drag and drop sur l'interface, et obtient un rapport complet sur le niveau de dangerosité du message analysé.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Backend | Python 3.11+ avec FastAPI |
| Analyse fichiers | python-magic, oletools, pymupdf, pefile |
| APIs externes | vt-py (VirusTotal), Google Safe Browsing |
| Frontend | React + TypeScript + Vite |
| Styles | Tailwind CSS |
| Base de données | SQLite (sqlite3 natif Python) |

---

## Architecture du projet

```
mailscope/
├── backend/
│   ├── app/
│   │   ├── main.py                  # Point d'entrée FastAPI, CORS, routes
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── routes.py            # Endpoints REST (/analyze, /result/{id})
│   │   ├── parsers/
│   │   │   ├── __init__.py
│   │   │   └── eml_parser.py        # Parsing .eml → headers, body, links, attachments
│   │   ├── analyzers/
│   │   │   ├── __init__.py
│   │   │   ├── magic_bytes.py       # Vérification type réel vs extension déclarée
│   │   │   ├── attachment.py        # Macros VBA (oletools) + scripts PDF (pymupdf)
│   │   │   ├── headers.py           # SPF, DKIM, DMARC, From/Reply-To, relais SMTP
│   │   │   └── scoring.py           # Score de risque global 0-100
│   │   ├── integrations/
│   │   │   ├── __init__.py
│   │   │   ├── virustotal.py        # API VirusTotal (vt-py)
│   │   │   └── safe_browsing.py     # API Google Safe Browsing
│   │   └── models/
│   │       ├── __init__.py
│   │       └── analysis.py          # Modèles Pydantic (AnalysisResult, etc.)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css                # Variables CSS dark theme + Tailwind
│   │   ├── components/
│   │   │   ├── DropZone.tsx         # Zone drag and drop fichier .eml
│   │   │   ├── ScoreCard.tsx        # Score de risque global avec couleur
│   │   │   ├── ResultDetail.tsx     # Détail par catégorie (headers, PJ, liens)
│   │   │   ├── AttachmentRow.tsx    # Ligne résultat pièce jointe
│   │   │   ├── LinkRow.tsx          # Ligne résultat lien analysé
│   │   │   └── ExportButton.tsx     # Bouton export rapport PDF
│   │   ├── pages/
│   │   │   └── Dashboard.tsx        # Page principale
│   │   ├── api/
│   │   │   └── client.ts            # Appels fetch vers le backend FastAPI
│   │   └── types/
│   │       └── analysis.ts          # Types TypeScript (AnalysisResult, etc.)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts               # Proxy /api → localhost:8000
│   ├── tailwind.config.js
│   └── tsconfig.json
└── README.md
```

---

## Lancer le projet en développement

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Remplir les clés API dans .env
uvicorn app.main:app --reload --port 8000
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

## Variables d'environnement (backend/.env)

```env
VIRUSTOTAL_API_KEY=your_key_here
GOOGLE_SAFE_BROWSING_KEY=your_key_here
```

---

## Tâches de développement détaillées

---

### TÂCHE 1 — Setup architecture FastAPI + structure backend
**Estimation : 1 man-day**

Mettre en place l'ensemble de la structure du projet backend et frontend, les dépendances, la configuration et le premier endpoint de santé.

**Backend à faire :**
- Créer `app/main.py` avec FastAPI, configuration CORS (autoriser `http://localhost:5173`), et inclusion des routes
- Créer `app/api/routes.py` avec deux endpoints :
  - `POST /api/analyze` → reçoit un fichier `.eml` via `UploadFile`, retourne un `task_id`
  - `GET /api/result/{task_id}` → retourne le résultat de l'analyse
  - `GET /api/health` → endpoint de santé qui retourne `{"status": "ok"}`
- Créer `app/models/analysis.py` avec les modèles Pydantic suivants :
  - `HeaderAnalysis` : spf, dkim, dmarc (pass/fail/unknown), from_addr, reply_to, mismatch (bool), suspicious_relay (bool)
  - `AttachmentResult` : filename, declared_type, real_type, mismatch (bool), has_macros (bool), has_scripts (bool), suspicious (bool)
  - `LinkResult` : url, virustotal (clean/malicious/suspicious/unknown), safe_browsing (safe/unsafe/unknown), suspicious (bool)
  - `AnalysisResult` : id, filename, score (int 0-100), risk_level (low/medium/high/critical), created_at, headers (HeaderAnalysis), attachments (list[AttachmentResult]), links (list[LinkResult])
- Créer `requirements.txt` avec : fastapi, uvicorn[standard], python-multipart, python-magic, oletools, pymupdf, vt-py, requests, pydantic, pydantic-settings

**Frontend à faire :**
- Initialiser le projet Vite + React + TypeScript
- Configurer Tailwind CSS
- Créer `vite.config.ts` avec proxy `/api` → `http://localhost:8000`
- Créer `src/types/analysis.ts` avec les interfaces TypeScript qui correspondent aux modèles Pydantic
- Créer `src/api/client.ts` avec les fonctions `analyzeEmail(file: File)` et `getResult(taskId: string)`
- Créer un `App.tsx` minimal avec une zone de drop et un message de bienvenue

**Critère de validation :**
- `GET /api/health` retourne `{"status": "ok"}`
- Le frontend s'affiche sans erreur sur `http://localhost:5173`

---

### TÂCHE 2 — Parsing .eml + vérification magic values
**Estimation : 1 man-day**

Implémenter le parsing complet d'un fichier `.eml` et la vérification du type réel des pièces jointes par leurs magic bytes.

**Fichier à créer : `app/parsers/eml_parser.py`**

Fonctions à implémenter :
- `parse_eml(file_bytes: bytes) -> dict` : parser le fichier `.eml` avec le module `email` de la stdlib Python et retourner un dictionnaire contenant :
  - `headers` : dictionnaire de tous les headers bruts (From, To, Subject, Reply-To, Received, DKIM-Signature, etc.)
  - `body_text` : contenu texte du mail
  - `body_html` : contenu HTML du mail si présent
  - `attachments` : liste de dicts `{filename, content_type, data (bytes)}`
  - `links` : liste de toutes les URLs extraites du body HTML et texte (utiliser `re` pour extraire les `http://` et `https://`)

**Fichier à créer : `app/analyzers/magic_bytes.py`**

Fonctions à implémenter :
- `get_real_type(file_bytes: bytes) -> str` : utiliser `python-magic` (`magic.from_buffer(data, mime=True)`) pour retourner le vrai type MIME du fichier
- `check_mismatch(filename: str, file_bytes: bytes) -> dict` : comparer l'extension déclarée du fichier avec son type réel détecté et retourner `{declared_type, real_type, mismatch (bool), suspicious (bool)}`

Exemples de discordances à détecter :
- `.pdf` dont le type réel est `application/x-dosexec` (EXE) → critique
- `.jpg` dont le type réel est `application/zip` → suspect
- `.docx` dont le type réel est `application/x-dosexec` → critique

**Critère de validation :**
- Un fichier `.eml` uploadé retourne bien ses headers, pièces jointes et liens extraits
- Un fichier `.exe` renommé en `.pdf` est détecté comme mismatch

---

### TÂCHE 3 — Analyse statique des pièces jointes (macros VBA + PDF)
**Estimation : 2 man-days**

Implémenter l'analyse statique des pièces jointes Office (macros VBA) et PDF (scripts embarqués).

**Fichier à créer : `app/analyzers/attachment.py`**

**Partie 1 — Analyse des fichiers Office avec oletools :**

Fonctions à implémenter :
- `analyze_office(file_bytes: bytes, filename: str) -> dict` :
  - Utiliser `oletools.olevba.VBA_Parser` pour analyser le fichier
  - Détecter la présence de macros VBA
  - Chercher les patterns dangereux : `AutoOpen`, `Document_Open`, `Shell`, `CreateObject`, `WScript`, `URLDownloadToFile`, `PowerShell`
  - Détecter les chaînes encodées en Base64 dans les macros
  - Retourner `{has_macros (bool), macro_count (int), suspicious_keywords (list[str]), autorun (bool), suspicious (bool)}`

Formats Office à supporter : `.doc`, `.xls`, `.ppt` (binaires OLE), `.docx`, `.xlsx`, `.pptx` (ZIP/XML)

**Partie 2 — Analyse des fichiers PDF avec pymupdf :**

Fonctions à implémenter :
- `analyze_pdf(file_bytes: bytes) -> dict` :
  - Ouvrir le PDF avec `fitz.open(stream=file_bytes, filetype="pdf")`
  - Chercher du JavaScript embarqué dans les métadonnées et les objets du document
  - Détecter les actions automatiques `/OpenAction` et `/AA` (s'exécutent à l'ouverture)
  - Extraire et lister les URIs embarquées dans le PDF
  - Retourner `{has_javascript (bool), has_autoaction (bool), embedded_uris (list[str]), suspicious (bool)}`

**Critère de validation :**
- Un `.docx` avec une macro `AutoOpen` est détecté comme suspect
- Un PDF avec du JavaScript embarqué est détecté comme suspect

---

### TÂCHE 4 — Analyse des headers SMTP (SPF, DKIM, DMARC)
**Estimation : 1.5 man-days**

Implémenter l'analyse des headers email pour détecter les indicateurs de phishing.

**Fichier à créer : `app/analyzers/headers.py`**

Fonctions à implémenter :

- `check_spf(headers: dict) -> str` : chercher le header `Authentication-Results` ou `Received-SPF` et extraire le résultat SPF (`pass`, `fail`, `softfail`, `neutral`, `unknown`)

- `check_dkim(headers: dict) -> str` : chercher le résultat DKIM dans `Authentication-Results` (`pass`, `fail`, `unknown`)

- `check_dmarc(headers: dict) -> str` : chercher le résultat DMARC dans `Authentication-Results` (`pass`, `fail`, `unknown`)

- `check_from_reply_to(headers: dict) -> dict` : comparer le domaine de l'adresse `From` avec celui du `Reply-To`. Retourner `{from_addr, reply_to, mismatch (bool)}`. Un `Reply-To` sur un domaine différent du `From` est un signal fort de phishing.

- `check_received_chain(headers: dict) -> dict` : analyser les headers `Received:` (il peut y en avoir plusieurs) pour reconstituer le chemin de relais SMTP. Détecter les IPs qui ne correspondent pas au domaine expéditeur déclaré. Retourner `{relay_count (int), suspicious_relay (bool), relay_chain (list[str])}`

- `analyze_headers(headers: dict) -> HeaderAnalysis` : fonction principale qui appelle toutes les fonctions ci-dessus et retourne un objet `HeaderAnalysis` complet

**Critère de validation :**
- Un mail avec SPF fail est détecté
- Un mail avec From différent du Reply-To remonte un mismatch

---

### TÂCHE 5 — Intégration APIs d'analyse de liens (VirusTotal + Google Safe Browsing)
**Estimation : 1.5 man-days**

Implémenter la pipeline d'analyse de réputation des liens en cascade.

**Stratégie pipeline en cascade :**
Pour chaque lien extrait, interroger les APIs dans l'ordre suivant et s'arrêter dès qu'un résultat positif (suspect/malveillant) est trouvé, afin de préserver les quotas :
1. Google Safe Browsing (gratuit, 10 000 req/jour) → premier filtre
2. VirusTotal (500 req/jour en gratuit) → uniquement si Safe Browsing ne détecte rien

**Fichier à créer : `app/integrations/safe_browsing.py`**

- `check_url_safe_browsing(url: str, api_key: str) -> str` : envoyer une requête POST à `https://safebrowsing.googleapis.com/v4/threatMatches:find` avec les types de menaces `MALWARE`, `SOCIAL_ENGINEERING`, `UNWANTED_SOFTWARE`. Retourner `"unsafe"` si des matches sont trouvés, `"safe"` sinon.

**Fichier à créer : `app/integrations/virustotal.py`**

- `check_url_virustotal(url: str, api_key: str) -> str` : utiliser le SDK `vt-py` pour soumettre l'URL et récupérer `last_analysis_stats`. Si `malicious > 0` retourner `"malicious"`, si `suspicious > 0` retourner `"suspicious"`, sinon `"clean"`.

**Fichier à modifier : `app/analyzers/` → créer `link_analyzer.py`**

- `analyze_links(links: list[str]) -> list[LinkResult]` : pour chaque lien, appliquer la pipeline en cascade et retourner la liste des `LinkResult`

**Critère de validation :**
- Un lien connu comme malveillant sur VirusTotal est retourné avec `virustotal: "malicious"`
- Si les clés API ne sont pas configurées, retourner `"unknown"` sans planter

---

### TÂCHE 6 — Score de risque global (0-100)
**Estimation : 0.5 man-day**

Concevoir et implémenter le calcul d'un score de risque global pondéré basé sur l'ensemble des signaux détectés.

**Fichier à créer : `app/analyzers/scoring.py`**

**Système de pondération à implémenter :**

| Signal | Points |
|---|---|
| Magic bytes mismatch sur une PJ | +30 |
| Macros VBA avec AutoOpen | +25 |
| Macros VBA sans AutoOpen | +15 |
| JavaScript embarqué dans PDF | +20 |
| SPF fail | +20 |
| DKIM fail | +15 |
| From / Reply-To mismatch | +20 |
| Relais SMTP suspect | +10 |
| Lien malveillant (VirusTotal) | +30 |
| Lien suspect (VirusTotal) | +15 |
| Lien unsafe (Safe Browsing) | +25 |

Le score est plafonné à 100.

**Niveaux de risque à déduire du score :**
- 0-25 → `low` (vert)
- 26-50 → `medium` (jaune)
- 51-75 → `high` (orange)
- 76-100 → `critical` (rouge)

Fonctions à implémenter :
- `calculate_score(headers: HeaderAnalysis, attachments: list[AttachmentResult], links: list[LinkResult]) -> int`
- `get_risk_level(score: int) -> str`

**Critère de validation :**
- Un mail avec SPF fail + lien malveillant + PJ suspecte → score > 75 → `critical`
- Un mail propre → score < 25 → `low`

---

### TÂCHE 7 — Frontend React : dashboard + zone d'upload
**Estimation : 2 man-days**

Développer l'interface utilisateur complète avec le dashboard de résultats.

**Design : dark theme** — fond `#0d1117`, surfaces `#161b22`, bordures `#30363d`

**Palette de couleurs :**
- Rouge critique : `#f85149`
- Jaune suspect : `#d29922`
- Vert propre : `#3fb950`
- Bleu info : `#58a6ff`

**Composant `DropZone.tsx` :**
- Zone de drag and drop qui accepte uniquement les fichiers `.eml`
- Feedback visuel au survol (bordure bleue, fond légèrement éclairé)
- Afficher le nom du fichier une fois déposé
- Bouton "Analyser" qui appelle `analyzeEmail(file)` depuis `api/client.ts`
- Afficher un spinner pendant l'analyse

**Composant `ScoreCard.tsx` :**
- Afficher le score en grand (ex : `87 / 100`)
- Couleur dynamique selon le niveau de risque (rouge/jaune/vert)
- Badge avec le libellé du niveau (`CRITIQUE`, `ÉLEVÉ`, `MOYEN`, `FAIBLE`)
- Nom du fichier analysé en sous-titre

**Composant `ResultDetail.tsx` :**
- Liste de lignes de résultats, chaque ligne contient :
  - Un point coloré (rouge/jaune/vert/bleu)
  - Un label descriptif
  - Une valeur
  - Un badge de sévérité
- Sections : Headers SMTP, Pièces jointes, Liens

**Composant `AttachmentRow.tsx` :**
- Nom du fichier, type déclaré vs type réel, badge suspect/ok
- Icône différente selon le type (PDF, Office, image, autre)

**Composant `LinkRow.tsx` :**
- URL tronquée si trop longue, résultat VirusTotal, résultat Safe Browsing, badge final

**Page `Dashboard.tsx` :**
- Assembler tous les composants
- Gérer les états : `idle` → `uploading` → `analyzing` → `done` / `error`
- Afficher les 4 métriques en haut (score, liens analysés, PJ, headers suspects)

**Critère de validation :**
- Un fichier `.eml` déposé déclenche l'analyse et affiche les résultats
- Le score change de couleur selon le niveau de risque

---

### TÂCHE 8 — Export du rapport PDF
**Estimation : 1 man-day**

Générer un rapport exportable synthétisant les résultats de l'analyse.

**Option recommandée : génération côté backend avec `reportlab` ou `fpdf2`**

**Endpoint à créer : `GET /api/result/{task_id}/export`**

Le rapport PDF doit contenir :
- En-tête avec le logo textuel "MailScope" et la date d'analyse
- Résumé : nom du fichier, score de risque, niveau de risque
- Section Headers SMTP : tableau avec SPF/DKIM/DMARC, From, Reply-To, résultat
- Section Pièces jointes : tableau avec nom, type déclaré, type réel, macros, scripts, verdict
- Section Liens : tableau avec URL, VirusTotal, Safe Browsing, verdict
- Conclusion : phrase de synthèse selon le niveau de risque

**Composant frontend `ExportButton.tsx` :**
- Bouton "Exporter le rapport PDF"
- Appeler `GET /api/result/{task_id}/export`
- Déclencher le téléchargement du fichier via un lien temporaire

**Critère de validation :**
- Le PDF se télécharge et contient toutes les sections
- Le nom du fichier PDF est `mailscope_rapport_{filename}_{date}.pdf`

---

### TÂCHE 9 — Connexion frontend/backend + tests
**Estimation : 0.5 man-day**

Vérifier l'intégration complète et corriger les éventuels problèmes de bout en bout.

**Points à vérifier :**
- Le proxy Vite redirige bien `/api` vers le backend FastAPI
- La gestion des erreurs est correcte côté frontend (fichier invalide, clé API manquante, timeout)
- Les types TypeScript correspondent bien aux réponses réelles de l'API
- Tester avec un vrai fichier `.eml` de phishing (disponibles sur des bases publiques comme PhishTank)
- Vérifier que le CORS est correctement configuré pour la production

**Tests manuels à effectuer :**
1. Déposer un `.eml` propre → score < 25, aucune alerte
2. Déposer un `.eml` avec un lien VirusTotal malveillant → score élevé
3. Déposer un `.eml` avec une PJ dont l'extension ne correspond pas → magic bytes mismatch détecté
4. Déposer un fichier non `.eml` → message d'erreur affiché

---

## Périmètre du projet (v1.0)

### Inclus
- Parsing `.eml`
- Vérification magic bytes
- Analyse macros VBA (oletools)
- Analyse scripts PDF (pymupdf)
- Headers SMTP (SPF, DKIM, DMARC, From/Reply-To)
- Liens (VirusTotal + Google Safe Browsing)
- Score de risque global
- Dashboard React dark theme
- Export rapport PDF

### Hors périmètre (évolutions futures)
- Analyse PE des exécutables (pefile)
- Détection de stéganographie dans les images
- Détection de typosquatting (distance de Levenshtein)
- Historique des analyses (SQLite)
- Unshortening des URLs raccourcies
- Support `.msg` (format Outlook)
- Connexion directe à une boîte mail via IMAP

---

## Ressources utiles

- [FastAPI — Upload de fichiers](https://fastapi.tiangolo.com/tutorial/request-files/)
- [oletools — Documentation](https://github.com/decalage2/oletools)
- [PyMuPDF — Documentation](https://pymupdf.readthedocs.io/)
- [VirusTotal API v3](https://developers.virustotal.com/reference/overview)
- [Google Safe Browsing API](https://developers.google.com/safe-browsing/v4/lookup-api)
- [python-magic](https://github.com/ahupp/python-magic)
