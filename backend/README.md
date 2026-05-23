# AI Video SaaS - Backend

Plain JavaScript (ESM) Node + Express backend for the React frontend in
`../client`. It satisfies the `/api/*` contract the frontend expects.

> **Status: AI-gated checkpoint.** Auth, projects, billing, and validation are
> wired. Project generation now requires `OPENAI_API_KEY` or `GEMINI_API_KEY`.
> The backend no longer creates fake plans, fake progress-to-DONE, or placeholder
> MP4 URLs. Until the Remotion worker is added, generated projects fail with a
> clear renderer-not-configured error and credits are refunded.

## Stack

| Layer | Tech |
|---|---|
| Server | Node + Express 4 (ESM JavaScript), helmet, cors, cookie-parser, morgan |
| Auth | Session cookies (`httpOnly`, `sameSite=lax`), argon2, custom `sessions` collection |
| DB | MongoDB via Mongoose |
| Validation | Zod |
| AI text | OpenAI or Gemini via API key |

## Layout

```txt
backend/
├── server.js              # entry: load env, connect DB, listen on :3001
├── src/
│   ├── app.js             # Express app (middleware + routes)
│   ├── db.js              # Mongoose connection (+ optional in-memory MongoDB)
│   ├── models.js          # User / Session / Project / Asset / CreditTx
│   ├── schemas.js         # Zod schemas + credit packs
│   ├── serialize.js       # Mongoose doc -> API DTO
│   ├── seed.js            # demo user (needs a persistent MONGODB_URI)
│   ├── lib/               # session, credits, AI-gated pipeline
│   ├── middleware/        # auth, validate, rateLimit, error
│   └── routes/            # auth, projects, enhance, billing, stripe, assets
├── .env / .env.example
└── README.md
```

## Setup

```bash
cd backend
cp .env.example .env
npm install
```

At least one text AI key is required before project generation will start:

```env
OPENAI_API_KEY=
# or
GEMINI_API_KEY=
```

Users can also save their own keys from the Profile page. Saved keys are
encrypted before storage and only the last 4 characters are returned to the UI.
Set admin emails in `.env` to enable the Admin page:

```env
ADMIN_EMAILS=you@example.com
API_KEY_ENCRYPTION_SECRET=changeme-another-long-random-string
```

## Database Options

- `USE_MEMORY_DB=true` runs an in-process MongoDB. It resets on every restart.
- `USE_MEMORY_DB=false` uses `MONGODB_URI`, such as MongoDB Atlas or local MongoDB.

## Run

```bash
npm run dev      # http://localhost:3001
# or
npm start
```

## Pair With Frontend

```bash
cd ../client
npm run dev      # http://localhost:5173, proxies /api -> :3001
```

## API Endpoints

All errors return `{ "error": "message" }`.

- `POST /api/auth/register` / `POST /api/auth/login` / `POST /api/auth/logout` / `GET /api/auth/me`
- `GET/PATCH /api/profile`
- `GET /api/admin/overview`
- `GET/POST /api/projects` / `GET/DELETE /api/projects/:id` / `POST /api/projects/:id/rerender`
- `POST /api/enhance-prompt`
- `GET /api/billing/transactions` / `GET /api/billing/packs`
- `POST /api/stripe/checkout` (simulated) / `POST /api/stripe/webhook`
- `POST /api/assets/presign` (returns an error until S3/R2 is configured)

## Next Steps

1. Add Redis + BullMQ.
2. Add the standalone Remotion worker.
3. Add Remotion compositions and real MP4 output.
4. Add fal.ai asset generation with gradient fallback.
5. Add S3/R2 presigned uploads and video uploads.
