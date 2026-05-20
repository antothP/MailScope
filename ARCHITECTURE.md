# Architecture MailScope

## Vue d'ensemble

MailScope est une application web composée de deux processus distincts qui communiquent via HTTP :

```
Navigateur (React)  ──HTTP/JSON──>  Backend (FastAPI)
   :5173                                :8000
```

---

## Démarrage

### Backend
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm run dev -- --port 5173
```

Le proxy Vite est configuré pour rediriger automatiquement les requêtes `/api/*` vers `http://localhost:8000`, ce qui évite les problèmes CORS en développement.

---

## Flux complet — que se passe-t-il quand on uploade un .eml ?

```
1. Utilisateur glisse un fichier .eml sur le DropZone
        │
2. DropZone.tsx appelle onFile(file)
        │
3. Dashboard.tsx appelle analyzeEml(file)   [api/client.ts]
        │
4. fetch POST /api/analyze  (multipart/form-data)
        │
        ▼
5. FastAPI reçoit la requête dans routes.py → analyze_eml()
        │
6. parse_eml(raw_bytes)                     [parsers/eml_parser.py]
   ├── extrait tous les headers
   ├── parcourt les parties MIME (msg.walk)
   │   ├── text/plain  → body_text
   │   ├── text/html   → body_html
   │   └── attachment  → liste Attachment {filename, content_type, size}
   └── retourne un objet ParsedEmail (validé par Pydantic)
        │
7. FastAPI sérialise en JSON et répond 200
        │
        ▼
8. Dashboard.tsx reçoit le ParsedEmail et met à jour l'état React
        │
9. Affichage : expéditeur, destinataires, objet, date, corps, pièces jointes
```

---

## Structure des fichiers

```
mailscope/
├── backend/
│   └── app/
│       ├── main.py              # Crée l'app FastAPI, CORS, monte le router
│       ├── api/
│       │   └── routes.py        # POST /api/analyze
│       ├── parsers/
│       │   └── eml_parser.py    # Logique de parsing MIME
│       ├── models/
│       │   └── analysis.py      # Modèles Pydantic : ParsedEmail, Attachment
│       ├── analyzers/           # (à venir) headers, pièces jointes, scoring
│       └── integrations/        # (à venir) VirusTotal, Safe Browsing
│
└── frontend/
    └── src/
        ├── main.tsx             # Point d'entrée React
        ├── App.tsx              # Racine de l'arbre de composants
        ├── pages/
        │   └── Dashboard.tsx    # Page principale : état + orchestration
        ├── components/
        │   └── DropZone.tsx     # Zone de dépôt du fichier
        ├── api/
        │   └── client.ts        # fetch vers /api/analyze
        └── types/
            └── analysis.ts      # Types TypeScript miroir des modèles Pydantic
```

---

## Modèle de données

Le backend retourne un `ParsedEmail` :

```json
{
  "subject": "Re: Facture Q3",
  "sender": "alice@example.com",
  "recipients": ["bob@example.com", "carol@example.com"],
  "date": "Mon, 20 May 2026 10:00:00 +0200",
  "body_text": "Bonjour...",
  "body_html": "<html>...",
  "attachments": [
    { "filename": "facture.pdf", "content_type": "application/pdf", "size": 42300 }
  ],
  "headers": {
    "From": "alice@example.com",
    "Message-ID": "<abc123@mail.example.com>",
    ...
  }
}
```

---

## Prochaines étapes

| Module | Rôle |
|---|---|
| `analyzers/headers.py` | Détecter les anomalies SPF/DKIM/DMARC |
| `analyzers/attachment.py` | Analyser les pièces jointes (magic bytes, macros OLE) |
| `analyzers/scoring.py` | Calculer un score de dangerosité global |
| `integrations/virustotal.py` | Soumettre les hachages à VirusTotal |
| `integrations/safe_browsing.py` | Vérifier les URLs via Google Safe Browsing |
