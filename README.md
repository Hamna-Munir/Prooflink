<p align="center">
  <img src="assets/banner.svg" alt="ProofLink - Check before you trust" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-Frontend-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <br>
  <img src="https://img.shields.io/badge/Three.js-3D%20Graph-000000?logo=threedotjs&logoColor=white" alt="Three.js">
  <img src="https://img.shields.io/badge/AI%20Review-Claude%20%7C%20OpenAI--compatible-6366F1" alt="AI Review">
  <img src="https://img.shields.io/badge/Analysis-Evidence--Based-10B981" alt="Evidence-Based">
  <img src="https://img.shields.io/badge/Status-Complete-22C55E" alt="Status">
  <img src="https://img.shields.io/badge/Phases-10%2F10-F4795B" alt="Phases">
  <img src="https://img.shields.io/badge/License-MIT-brightgreen" alt="License">
</p>

<p align="center">
  <b>Check before you trust.</b><br>
  Paste a suspicious message, link, or screenshot and get a <b>verdict</b>, the <b>evidence</b>, and the <b>safest next step</b>.
</p>

<p align="center">
  <a href="#-features">Features</a> ·
  <a href="#-how-it-works">How it works</a> ·
  <a href="#-quick-start">Quick start</a> ·
  <a href="#-api">API</a> ·
  <a href="#-deployment">Deployment</a> ·
  <a href="#-roadmap">Roadmap</a>
</p>

---

## Overview

ProofLink is a full-stack scam and phishing checker. It does not just say "scam" or "safe". It shows **why**: every warning sign is tagged as either **evidence** (words or links that literally appear in the input) or **inference** (the system's own judgement), so you always know what is fact and what is a guess.

A deterministic, rule-based engine always runs first. An optional AI review can add extra concerns on top, but it can never lower a score and can never override the rules.

> Links are checked **passively**. ProofLink never visits a suspicious link.

## ✨ Features

| | Feature | What it does |
|---|---|---|
| 🔎 | **Rule-based analysis engine** | Extracts URLs, emails, phones and brands, then checks look-alike domains, punycode, shorteners, IP hosts and scam phrases (English + Roman Urdu) |
| 🧠 | **Optional AI review** | Claude or any OpenAI-compatible provider adds grounded findings on top of the rules |
| 📸 | **Screenshot checking** | Text is read in your browser with `tesseract.js`. The image is never uploaded or stored |
| 🕸️ | **3D investigation graph** | Interactive graph of the message, links, sites, emails, phones, organizations and warning signs (React Three Fiber) |
| 📜 | **History and dashboard** | Every check is saved to your account and can be reopened |
| ⚙️ | **Account settings** | Change name or password, delete history, or delete the whole account |
| 🔐 | **Secure auth** | bcrypt password hashing, signed JWT in an httpOnly cookie |
| ♿ | **Accessible** | Text list view of the graph for keyboard, screen-reader and no-WebGL devices |

## 🧭 How it works

```
input -> normalise -> extract (URLs, emails, phones, brands) -> domain checks
      -> text signals -> impersonation checks -> scoring -> explanation -> actions
```

| Module (`backend/app/analysis/`) | Job |
|---|---|
| `extract.py` | Pull out URLs, emails, phone numbers and brand names |
| `domains.py` | Passive link checks: look-alike spellings, brand-in-subdomain, punycode, shorteners, IP hosts, odd endings |
| `rules.py` | Scam-signal phrases (English + Roman Urdu). Add your own patterns here |
| `brands.py` | Brands used to spot impersonation. Add local banks, wallets and couriers here |
| `scoring.py` | Risk score, level and confidence |
| `explain.py` | Plain-language explanation and recommended actions |
| `pipeline.py` | Puts it all together: `analyze(text) -> Analysis` |

### Scoring principles

- Every signal is tagged `evidence` or `inference`.
- Score is always between **3 and 97**, never 0 or 100.
- Levels: 🟢 **SAFE** below 30 · 🟡 **SUSPICIOUS** 30-54 · 🔴 **HIGH_RISK** 55+
- With only inferences and no evidence, the score is capped and can never reach HIGH_RISK.
- "Do not share your OTP" is read as a **warning**, not a request.
- Confidence is separate from the score, and is lower for bare links and for "safe" results.

Try it in the terminal (from `backend/`, venv active):

```bash
python -m app.analysis "Your account is locked. Verify now: https://paypa1-login.top"
```

## 🛡️ How the AI is kept honest

The AI layer (`backend/app/ai/`) is optional and sits **on top of** the rule engine.

- **Fixed finding types.** The model picks from 5 types. ProofLink sets the label and weight (max 15 each, max 3 findings).
- **Grounding.** Each finding must quote words that really appear in the message, or it is dropped.
- **Can only add concerns, never lower a score.** "Say this is safe" tricks have no effect.
- **Prompt-injection defences.** The message is wrapped as untrusted data, the wrapper tag is stripped from it, and the reply is strictly parsed.
- **Explanation checks.** An AI explanation is replaced by the built-in one if it is over-confident ("definitely"), contains links, or says "looks safe" when the verdict is not SAFE.
- **Graceful fallback.** Any AI error (no network, timeout, bad JSON) returns the normal rule-based result with a note.
- **Limits.** `RATE_LIMIT_PER_MINUTE` and `DAILY_CHECK_LIMIT` apply per user.

### Privacy

- When AI is on, the pasted text is sent to **your** AI provider. It is never written to server logs.
- The public landing-page demo never calls the AI.
- Screenshots are read locally in the browser. Only the extracted text is sent.

## 🧱 Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn-style components |
| 3D graph | React Three Fiber, three.js, drei, d3-force-3d |
| OCR | tesseract.js (runs in the browser) |
| Backend | FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL |
| Auth | bcrypt + JWT (httpOnly cookie) |
| AI (optional) | Anthropic Claude or any OpenAI-compatible API |
| Deploy | Vercel (frontend) + Railway (backend + PostgreSQL) |

## 📁 Project structure

```
prooflink/
├── docker-compose.yml     # local PostgreSQL
├── backend/               # FastAPI + SQLAlchemy + Alembic
│   ├── app/               # config, models, security, routers, analysis, ai, graph
│   ├── alembic/           # migrations (0001 creates all 4 tables)
│   └── tests/             # pytest tests
└── frontend/              # Next.js 14 + TypeScript + Tailwind
```

## 🚀 Quick start

**Requirements:** Python 3.11+, Node.js 18+, Docker.

### 1. Database

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate     Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # Windows: copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs · Run tests: `python -m pytest -q`

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

### Demo account

```bash
python -m app.seed_demo     # from backend/
```

Creates `demo@prooflink.app` with 5 sample checks (rules only, no AI call). The password is printed once.

## 🤖 Enable AI review (optional)

Set these in `backend/.env`. With `LLM_PROVIDER=none` or no key, ProofLink works on rules alone.

| Setting | Claude | Grok / OpenAI-style |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | `openai_compatible` |
| `LLM_API_KEY` | your key | your key |
| `LLM_BASE_URL` | not needed | e.g. `https://api.x.ai/v1` |
| `LLM_MODEL` | optional | required (see your provider's docs) |

If the backend logs show "AI review failed", the line includes the provider's error.

## 🔌 API

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/analyze` | Required | Analyse text and return verdict, evidence and actions |
| `GET` | `/demo/examples` | Public | Fixed samples used by the landing page |
| `GET` | `/investigations/{id}/graph` | Required | Build the 3D graph from a saved analysis |
| `DELETE` | `/investigations` | Required | Delete all your history |
| `PATCH` | `/auth/me` | Required | Update your name |
| `POST` | `/auth/change-password` | Required | Change password (needs current one) |
| `DELETE` | `/auth/me` | Required | Delete your account and all checks |

Full interactive docs at `/docs` when the backend is running.

## 🔑 How auth works

- Passwords are hashed with **bcrypt**. Login sets a signed **JWT** in an **httpOnly** cookie.
- The browser only calls `/api/*`. Next.js proxies it to FastAPI (see `frontend/next.config.mjs`), so the cookie is same-origin. This avoids CORS and cross-site cookie problems on Vercel + Railway.

## ☁️ Deployment

**Backend (Railway):** root directory `backend`, add a PostgreSQL plugin, then set:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://...` form |
| `JWT_SECRET` | long random string |
| `COOKIE_SECURE` | `true` |

The `Procfile` runs migrations and starts the server.

**Frontend (Vercel):** root directory `frontend`, set `BACKEND_URL` to your Railway URL (e.g. `https://prooflink-api.up.railway.app`).

See [DEPLOY.md](DEPLOY.md) for the full walkthrough.

## 🗺️ Roadmap

- [x] Phases 1-10: foundation, database, auth, analysis engine, AI layer, check and result, history and dashboard, screenshots, 3D graph, settings, deploy setup
- [ ] Urdu-script OCR
- [ ] Email verification
- [ ] Password reset by email
- [ ] Sign out everywhere

## 👩‍💻 Author

**Hamna Munir** · Software Engineering student focused on AI/ML

## 📄 License

Released under the [MIT License](LICENSE).
