# Clinical Intake Agent

An AI-powered pre-visit clinical intake system. A conversational agent (backed by **Groq + LLaMA 3.1**) acts as an intake nurse, guiding a patient through Chief Complaint → History of Present Illness → Review of Systems, then generates a structured clinical brief ready for physician review.

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Django 4.2 + Django REST Framework  |
| AI Agent  | Groq API — `llama-3.1-8b-instant`   |
| Voice STT | OpenAI Whisper (runs locally)       |
| Database  | SQLite (zero config)                |
| Frontend  | React 18 + Vite                     |

---

## Project Structure

```
clinical-intake/
├── .gitignore
├── README.md
│
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── setup.sh                  ← one-command bootstrap
│   ├── .env.example              ← copy to .env and fill in keys
│   ├── API_REFERENCE.md          ← all endpoints documented
│   │
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   └── development.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   │
│   └── apps/
│       ├── core/
│       └── intake/
│           ├── models.py         ← IntakeSession, Message, ClinicalBrief
│           ├── serializers.py
│           ├── views.py          ← 6 API endpoints
│           ├── urls.py
│           ├── agent/
│           │   ├── prompts.py        ← system prompts
│           │   ├── intake_agent.py   ← Groq conversation logic
│           │   └── brief_generator.py
│           └── services/
│               └── whisper_service.py
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js            ← proxies /api → Django
    └── src/
        ├── App.jsx               ← root layout
        ├── index.css             ← design tokens + global styles
        ├── api/
        │   └── intakeApi.js      ← all Axios calls
        ├── hooks/
        │   └── useIntakeSession.js
        └── components/
            ├── ProgressBar.jsx   ← CC → HPI → ROS → Done stepper
            ├── ChatPanel.jsx     ← conversation thread + input bar
            ├── VoiceRecorder.jsx ← mic button with live timer
            └── BriefPanel.jsx    ← live data + final brief view
```

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- `ffmpeg` installed on your OS (required for Whisper audio conversion)

```bash
# Ubuntu / WSL
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows — download from https://ffmpeg.org/download.html
# and add to PATH
```

---

## Setup

### 1 — Get a free Groq API key

1. Go to [console.groq.com](https://console.groq.com) and sign up (free, no credit card)
2. Click **API Keys → Create API Key**
3. Copy the key (starts with `gsk_…`)

### 2 — Backend

```bash
cd clinical-intake/backend

# Run the setup script (creates venv, installs deps, runs migrations)
chmod +x setup.sh
./setup.sh

# Copy and fill in your environment file
cp .env.example .env
# Open .env and set GROQ_API_KEY=gsk_your_key_here

# Start the Django dev server
source venv/bin/activate        # Windows: venv\Scripts\activate
python manage.py runserver
# → http://127.0.0.1:8000
```

### 3 — Frontend

```bash
cd clinical-intake/frontend
npm install
npm run dev
# → http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
DEBUG=True
SECRET_KEY=django-insecure-change-this

# Required — get free key at console.groq.com
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-8b-instant

# Optional — change Whisper model size (base/small/medium)
WHISPER_MODEL=base

ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

>  

---

## API Endpoints

All endpoints are under `http://127.0.0.1:8000/api/intake/`

| Method | Endpoint                              | Description                          |
|--------|---------------------------------------|--------------------------------------|
| POST   | `/sessions/`                          | Create a new intake session          |
| GET    | `/sessions/`                          | List all sessions                    |
| GET    | `/sessions/{id}/`                     | Get full session with messages       |
| DELETE | `/sessions/{id}/`                     | Delete a session                     |
| POST   | `/sessions/{id}/message/`             | Send text → get agent reply          |
| POST   | `/sessions/{id}/transcribe/`          | Upload audio → transcribe → reply    |
| POST   | `/sessions/{id}/generate-brief/`      | Generate the clinical brief          |
| GET    | `/sessions/{id}/brief/`               | Retrieve the generated brief         |

See `backend/API_REFERENCE.md` for full request/response examples.

---

## Testing the API (PowerShell)

```powershell
# Create session
$session = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/intake/sessions/" -Method POST
$SESSION_ID = $session.id
Write-Host "Session: $SESSION_ID"

# Send a message
$body = @{ content = "I have chest pain for 3 days" } | ConvertTo-Json
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/intake/sessions/$SESSION_ID/message/" `
  -Method POST -ContentType "application/json" -Body $body

# Generate brief
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/intake/sessions/$SESSION_ID/generate-brief/" `
  -Method POST
```

---

## How the Intake Flow Works

```
Patient opens app
      │
      ▼
Phase 1 — Chief Complaint (CC)
  Agent asks: "What brings you in today?"
  Extracts: complaint, duration
      │
      ▼
Phase 2 — History of Present Illness (HPI)
  Agent uses OLD CARTS framework:
  Onset · Location · Duration · Character
  Aggravating · Relieving · Radiation · Timing · Severity
      │
      ▼
Phase 3 — Review of Systems (ROS)
  Agent sweeps through: Constitutional · Cardiovascular
  Respiratory · GI · Neurological · MSK · Skin
      │
      ▼
Brief Generation
  GPT produces structured CC / HPI / ROS JSON
  + full EHR-formatted note
```

---

## Voice Input

The app uses your browser's `MediaRecorder` API to capture audio, sends it to the `/transcribe/` endpoint, which runs **Whisper locally** (no cloud cost) and returns a transcript. The transcript is then passed to the agent exactly like a typed message.

> Whisper downloads the model (~140 MB for `base`) on first use. This is a one-time download stored in `~/.cache/whisper`.

---

## Django Admin

Create a superuser to inspect sessions, messages, and briefs in the built-in admin UI:

```bash
python manage.py createsuperuser
# → http://127.0.0.1:8000/admin/
```
