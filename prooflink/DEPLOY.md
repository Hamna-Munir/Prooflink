# Deploying ProofLink (Railway + Vercel)

Order matters: **database and backend first, then the frontend**, because the frontend needs the backend's address.
Do this once on a calm day, not the morning of the demo.

## 0. Before you start
- Push the project to a GitHub repository. `.env`, `*.db`, `node_modules` and `.next` are already in `.gitignore`. Check that `git status` does not list a `.env` file before you push.
- Make a **new** Groq key just for deployment (console.groq.com → API Keys) and delete any key you have pasted into chats or screenshots.
- Make a long random secret for sessions. Run this once and keep the output:
  ```
  python -c "import secrets; print(secrets.token_urlsafe(48))"
  ```

## 1. Backend + database on Railway
1. railway.app → **New Project** → **Deploy PostgreSQL**.
2. In the same project: **New** → **GitHub Repo** → pick the repo. Open the new service → **Settings** → set **Root Directory** to `backend`. (`railway.json` and `Procfile` there already run the migrations and start the server, and tell Railway to check `/health`.)
3. Service → **Variables** → add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (use the "Add reference" button, so it always points at your database) |
   | `JWT_SECRET` | the long random string from step 0 |
   | `COOKIE_SECURE` | `true` |
   | `LLM_PROVIDER` | `openai_compatible` (or `none` to run on rules only) |
   | `LLM_API_KEY` | your new Groq key |
   | `LLM_BASE_URL` | `https://api.groq.com/openai/v1` |
   | `LLM_MODEL` | `openai/gpt-oss-20b` |

   `PORT` is set by Railway. You do **not** need `CORS_ORIGINS`: the browser only talks to the Vercel site, which forwards `/api/*` to the backend.
4. Service → **Settings** → **Networking** → **Generate Domain**. You get something like `https://prooflink-api-production.up.railway.app`.
5. Open `https://<that-domain>/health`. You should see `{"status":"ok", ... "ai_enabled":true}`.
   - The backend **refuses to start** if `COOKIE_SECURE=true` and `JWT_SECRET` is short or still the default. The deploy log will say so.
   - `DATABASE_URL` may start with `postgresql://`. That is fine, ProofLink rewrites it for the driver.

## 2. Frontend on Vercel
1. vercel.com → **Add New** → **Project** → import the same repo → set **Root Directory** to `frontend`. Framework: Next.js (detected).
2. **Environment Variables** → add `BACKEND_URL` = `https://<your-railway-domain>` (with `https://`, no trailing slash). Add it **before** the first deploy: Next.js bakes it into the build. If you change it later, **Redeploy**.
3. Deploy. Open the Vercel URL, sign up, run a check.

## 3. Check it works (2 minutes)
- [ ] Sign up and log in, then refresh: you stay logged in (the cookie works).
- [ ] Check a suspicious message. The result shows the ✨ "AI helped" line (if AI is on).
- [ ] Upload a screenshot on **Check something**. The first time it takes a few seconds while the text reader downloads.
- [ ] Open a result → **3D view** loads.
- [ ] Settings → change name, then reload.
- [ ] `https://<railway-domain>/docs` is the API explorer. It is public. That is fine for a demo.

## 4. Demo data (optional)
Quickest: sign up on the live site and press the example buttons on **Check something**.
For a ready-made account with 5 saved checks, run this on your own computer against the live database
(Railway → Postgres → **Connect** → copy the **public** connection URL):
```
cd backend
# Windows PowerShell:  $env:DATABASE_URL="<public url>"
# Mac/Linux:           export DATABASE_URL="<public url>"
python -m app.seed_demo
```
It prints the demo login once. It adds nothing if the account already has checks.

## If something goes wrong
| Symptom | Likely cause |
|---|---|
| Login works but you are logged out after refresh | `COOKIE_SECURE` is not `true` on Railway, or you are testing on plain `http://` |
| Every page says "couldn't reach the server" | `BACKEND_URL` missing or wrong on Vercel. Fix it and **Redeploy** |
| Railway deploy fails at start with a JWT_SECRET message | Set a long `JWT_SECRET` (step 0) |
| `ai_enabled` is `false` at `/health` | `LLM_PROVIDER` must be exactly `openai_compatible`, and `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` must all be set |
| Results show "AI review was unavailable" | Look at the Railway **Deploy Logs** for the line "AI review failed". It contains the provider's real error (bad key, wrong model name, rate limit) |
| Screenshot upload says it could not read the image | The visitor's browser could not download the text reader (offline or blocked CDN). Pasting the text still works |
| 3D page is blank | Use a recent Chrome, Edge or Safari with hardware acceleration on. The **List view** tab always works |

## Good to know (limits of this setup)
- The per-minute rate limit is kept in memory, which is correct for one backend instance. If you scale to several, move it to Redis.
- Changing your password does not log out other devices that are already signed in. They stay signed in until their 7-day session ends.
- Saved checks are text only. Screenshots are never stored, and the OCR runs in the visitor's browser.
