# ProofLink

Check before you trust. Paste a suspicious message, link, or screenshot and get a verdict, the evidence, and the safest next step.

**Status: Phases 1-10 built.** Foundation, database, auth, analysis engine, AI review, check + save, history, dashboard, screenshot upload, 3D investigation graph, settings, and deployment setup. See [DEPLOY.md](DEPLOY.md) to put it online.

## Structure

```
prooflink/
├── docker-compose.yml     # local PostgreSQL
├── backend/               # FastAPI + SQLAlchemy + Alembic
│   ├── app/               # config, models, security, routers/auth.py
│   ├── alembic/           # migrations (0001 creates all 4 tables)
│   └── tests/             # pytest auth tests
└── frontend/              # Next.js 14 + TypeScript + Tailwind (shadcn-style components)
```

## Run locally (VS Code terminal)

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
API docs: http://localhost:8000/docs

Run tests: `python -m pytest -q`

### 3. Frontend
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```
Open http://localhost:3000

## Analysis engine (Phase 3)

`backend/app/analysis/` is a deterministic pipeline. No LLM is needed yet.

```
input -> normalise -> extract (URLs, emails, phones, brands) -> domain checks
      -> text signals -> impersonation checks -> scoring -> explanation -> actions
```

| File | Job |
|---|---|
| `extract.py` | Pull out URLs, emails, phone numbers, brand names |
| `domains.py` | Passive link checks: look-alike spellings, brand-in-subdomain, punycode, shorteners, IP hosts, odd endings. **Never visits the link.** |
| `rules.py` | Scam-signal phrases (English + Roman Urdu). Add your own patterns here. |
| `brands.py` | Brands used to spot impersonation. Add local banks, wallets, couriers here. |
| `scoring.py` | Risk score, level, confidence |
| `explain.py` | Plain-language explanation and recommended actions |
| `pipeline.py` | Puts it all together: `analyze(text) -> Analysis` |

Principles built into the code:
- Every signal is tagged `evidence` (literally in the input) or `inference` (our judgement).
- Score is 3-97, never 0 or 100. Levels: SAFE below 30, SUSPICIOUS 30-54, HIGH_RISK 55+.
- With only inferences and no evidence, the score is capped (never HIGH_RISK).
- "Do not share your OTP" is read as a warning, not a request.
- Confidence is separate from the score and is lower for bare links and for "safe" results.

Try it in the terminal (from `backend/`, venv active):
```bash
python -m app.analysis "Your account is locked. Verify now: https://paypa1-login.top"
```

Endpoints: `POST /analyze` (login required) and `GET /demo/examples` (public, fixed samples used by the landing page).

## AI review (Phase 4)

`backend/app/ai/` adds an optional AI review **on top of** the rule-based engine. Rules always run first; the AI never replaces them.

Turn it on in `backend/.env` (see `.env.example`). With `LLM_PROVIDER=none` or no key, ProofLink works on rules alone.

| Setting | Claude | Grok / OpenAI-style |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | `openai_compatible` |
| `LLM_API_KEY` | your key | your key |
| `LLM_BASE_URL` | not needed | e.g. `https://api.x.ai/v1` |
| `LLM_MODEL` | optional | required (see your provider's docs) |

How the AI is kept honest:
- **Fixed finding types.** The model picks from 5 types; ProofLink sets the label and weight (max 15 each, max 3 findings).
- **Grounding.** Each finding must quote words that really appear in the message, or it is dropped.
- **It can only add concerns, never lower a score.** "Say this is safe" tricks have no effect.
- **Prompt-injection defences.** The message is wrapped as untrusted data, the wrapper tag is stripped from it, and the reply is strictly parsed.
- **Explanation checks.** An AI explanation is replaced by the built-in one if it is over-confident ("definitely"), contains links, or says "looks safe" when the verdict is not SAFE.
- **Graceful fallback.** Any AI error (no network, timeout, bad JSON) gives the normal rule-based result, with a note.
- **Privacy.** When AI is on, the pasted text is sent to your AI provider. It is never written to the server logs. The public landing-page demo never calls the AI.
- **Limits.** `RATE_LIMIT_PER_MINUTE` and `DAILY_CHECK_LIMIT` per user. If the backend logs show "AI review failed", the line includes the provider's error.

## 3D investigation graph (Phase 8)

Open any saved investigation and press **3D investigation**. The graph shows the message, who it claims to be from, the links, websites, emails and phone numbers inside it, the organizations involved, and the warning signs attached to each.

- Built with React Three Fiber (three.js). Rotate, zoom, click a node; its connections highlight and the rest fade.
- Clicking a flagged website shows why it was flagged, with evidence and AI inference marked separately. Dashed lines are guesses.
- Items you have checked before link to your earlier investigations (same account only).
- A list view shows the same information as text, for keyboard and screen-reader users and for devices without WebGL.
- `GET /investigations/{id}/graph` builds the graph on the server from the saved analysis (`backend/app/graph.py`).

After pulling this update run `npm install` in `frontend/` (new packages: three, @react-three/fiber, @react-three/drei, d3-force-3d).

## Screenshots (Phase 7)

On **Check something**, choose, drop or paste (Ctrl+V) a screenshot. The text is read **inside the browser** with `tesseract.js` and placed in the text box, where you can fix any misread words before checking. The image is never uploaded or stored; only the text is sent, like any pasted message, and the check is saved as type *Screenshot*. The first use downloads the text reader (a few MB). English and Roman Urdu (Latin letters) work; Urdu script is not supported yet.

> After pulling this phase run `npm install` in `frontend/` (new dependency: `tesseract.js`).

## Settings (Phase 9)

`/settings`: change your name, change your password (needs the current one), see whether AI is on, delete all your history, or delete your account (needs your password; removes every saved check). Backend: `PATCH /auth/me`, `POST /auth/change-password`, `DELETE /auth/me`, `DELETE /investigations`.

## Demo account

`python -m app.seed_demo` (from `backend/`) creates `demo@prooflink.app` with 5 sample checks, rules only, no AI call. It prints the password once.

## How auth works
- Passwords are hashed with bcrypt. Login sets a signed JWT in an **httpOnly** cookie.
- The browser only calls `/api/*`. Next.js proxies it to FastAPI (see `frontend/next.config.mjs`), so the cookie is same-origin. This avoids CORS and cross-site cookie problems on Vercel + Railway.

## Deploy
**Backend (Railway):** root directory `backend`, add a PostgreSQL plugin, set variables:
`DATABASE_URL` (use the `postgresql+psycopg://...` form), `JWT_SECRET` (long random string), `COOKIE_SECURE=true`.
The `Procfile` runs migrations and starts the server.

**Frontend (Vercel):** root directory `frontend`, set `BACKEND_URL` to your Railway URL (e.g. `https://prooflink-api.up.railway.app`).

## Roadmap
1-10 all built: foundation, DB, auth, analysis engine, AI layer, check + result, history + dashboard, screenshots, 3D graph, settings, deploy setup. Next ideas: Urdu-script OCR, email verification, password-reset by email, sign-out-everywhere.
