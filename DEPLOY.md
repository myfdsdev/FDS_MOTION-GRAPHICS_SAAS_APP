# Deploying to Render / Railway / Fly

This app is **two long-running services** sharing one MongoDB Atlas database:

| Service | What it runs | Notes |
|---|---|---|
| **web** | `backend/server.js` — Express API **+ the built React frontend on the same origin** | Node runtime. Stateless. |
| **worker** | `backend/worker.js` — Remotion render loop (headless Chrome) | Needs Chromium libs → use `backend/Dockerfile.worker`. CPU/RAM heavy. |

Same-origin serving (web serves `client/dist` and `/api`) means the auth cookie works with no cross-site/CORS config.

## Prerequisites
1. **Rotate secrets** that were exposed in development (Gemini key, Atlas password).
2. MongoDB Atlas: create a DB user scoped to the `aivideo` DB and allow your host's egress IPs (or `0.0.0.0/0` if the platform has dynamic IPs).
3. Generate strong values for `SESSION_SECRET` and `API_KEY_ENCRYPTION_SECRET`.

## Environment variables (set in the dashboard, mark secrets)
```
NODE_ENV=production
PORT=3000
USE_MEMORY_DB=false
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster/aivideo?...
SESSION_SECRET=<long-random>
SESSION_COOKIE_NAME=avs_session
API_KEY_ENCRYPTION_SECRET=<long-random>
GEMINI_API_KEY=<your-key>
GEMINI_MODEL=gemini-2.5-flash        # 1.5 is retired
WEB_ORIGIN=https://<your-web-domain> # the web service URL
PUBLIC_BASE_URL=https://<your-web-domain>
# optional: OPENAI_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ADMIN_EMAILS, FAL_API_KEY
```
The worker needs `MONGODB_URI`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `API_KEY_ENCRYPTION_SECRET`, `PUBLIC_BASE_URL`.

## Render (blueprint)
`render.yaml` at the repo root defines both services. Push to GitHub → Render → **New → Blueprint** → fill the `sync: false` secrets. `trust proxy` is already set so secure cookies work behind Render's TLS.

## Railway / Fly
- **web:** build `cd client && npm ci && npm run build && cd ../backend && npm ci`; start `node backend/server.js`. Health check `/health`.
- **worker:** deploy `backend/Dockerfile.worker` (Fly: `fly launch` in `backend/` with that Dockerfile; Railway: set the service's Dockerfile path).

## Video storage — Cloudflare R2 (required for playback in prod)
The worker uploads each rendered MP4 to object storage and sets `outputUrl` to
the public object URL (the frontend `<video>` loads it directly). Without
storage configured it falls back to a local `/videos/...` URL that won't be
reachable across split services — so **configure R2 for production**.

**Create the bucket + keys (Cloudflare dashboard):**
1. **R2 → Create bucket**, e.g. `remotion-videos`.
2. Bucket **Settings → Public access → enable the r2.dev Public Development
   URL** (gives `https://pub-<hash>.r2.dev`), or attach a custom domain →
   this is `S3_PUBLIC_URL`.
3. **R2 → Manage API Tokens → Create API token**, permission **Object Read &
   Write** → copy the **Access Key ID**, **Secret Access Key**, and the
   **S3 API endpoint** `https://<accountid>.r2.cloudflarestorage.com`.

**Set on the worker service:**
```
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=remotion-videos
S3_ACCESS_KEY=<access key id>
S3_SECRET_KEY=<secret access key>
S3_PUBLIC_URL=https://pub-<hash>.r2.dev
```
If the browser logs a CORS error on the `<video>`, add a bucket CORS rule
allowing `GET` from the client origin (plain playback usually needs none).

## Deploy the render worker (second service)
Render → **New → Background Worker** (or the `render.yaml` blueprint's `worker`):
- Runtime **Docker**, dockerfile `backend/Dockerfile.worker`, context `backend`.
- Plan **Standard** (rendering is CPU/RAM heavy).
- Env: `NODE_ENV=production`, `USE_MEMORY_DB=false`, `MONGODB_URI`,
  `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash`,
  `API_KEY_ENCRYPTION_SECRET`, and the six `S3_*` vars above.

Without the worker, projects stay at `QUEUED` (no MP4 is produced).

## Still simulated / not production-grade
- **Stripe checkout is faked** (`/api/stripe/checkout` just grants credits). Wire real Stripe + verify the webhook before charging.
- In-memory rate limiter resets per instance — fine for one web instance; use a shared store if you scale out.
- Swap `morgan("dev")` for a JSON/prod logger if you want structured logs.

## Smoke test after deploy
1. `GET https://<web>/health` → `{"ok":true}`
2. Open the site, register, reload — you stay logged in (cookie over HTTPS).
3. Create a video → status reaches DONE and the `<video>` plays from the R2
   URL (`outputUrl` should be `https://pub-<hash>.r2.dev/videos/<id>.mp4`).
