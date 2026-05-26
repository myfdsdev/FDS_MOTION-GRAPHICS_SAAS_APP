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

## ⚠️ Video storage — required for playback in prod
The worker writes MP4s to **its own local disk** and `outputUrl` points at the **web** service. With separate web/worker services these are **different disks**, so the web service returns **404** for `/videos/<id>.mp4`. Also, PaaS disks are **ephemeral** (wiped on redeploy).

**Fix before launch:** store renders in **S3 / Cloudflare R2** and have the worker upload there, setting `outputUrl` to the object URL (this also makes `/api/assets/presign` real). The single-VM alternative (run web+worker on one box with a shared/persistent disk, e.g. a Fly volume) avoids this but doesn't scale. Ask and I'll wire S3/R2.

## Still simulated / not production-grade
- **Stripe checkout is faked** (`/api/stripe/checkout` just grants credits). Wire real Stripe + verify the webhook before charging.
- In-memory rate limiter resets per instance — fine for one web instance; use a shared store if you scale out.
- Swap `morgan("dev")` for a JSON/prod logger if you want structured logs.

## Smoke test after deploy
1. `GET https://<web>/health` → `{"ok":true}`
2. Open the site, register, reload — you stay logged in (cookie over HTTPS).
3. Create a video → status reaches DONE. If the `<video>` 404s, that's the storage caveat above.
