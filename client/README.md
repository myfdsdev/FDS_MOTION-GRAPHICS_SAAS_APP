# AI Video SaaS — Frontend

React + Vite frontend for the Level 1 AI video generation SaaS. Pixel-faithful to the Motionvid.ai reference; ships with a mock data layer so you can develop the whole UI without a backend.

## Stack

- **React 18 + Vite 5** (TypeScript)
- **Tailwind CSS** with custom dark-theme tokens
- **shadcn/ui-style primitives** (Button, Input, Card, Popover, Badge) — Radix UI under the hood, only what we actually need
- **React Router v6** (data router)
- **TanStack Query v5** for server state + polling
- **React Hook Form + Zod** for forms
- **Framer Motion** for UI animations
- **lucide-react** for icons
- **Sonner** for toasts

## Quick start

```bash
pnpm install        # or npm install / yarn
pnpm dev            # opens http://localhost:5173
```

You'll land on the homepage. **Mock mode is on by default** — sign in with any email/password, create projects, watch status transitions, and top up credits without any backend running.

## Switch from mocks to the real backend

Edit `.env`:

```bash
VITE_USE_MOCKS=false
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api/*` to `http://localhost:3001` (see `vite.config.ts`). Start your Express backend there and everything Just Works — same query hooks, same component code.

The API contract is defined in `src/lib/api.ts`. Each function has a `USE_MOCKS` switch:

```ts
export async function listProjects(): Promise<Project[]> {
  if (USE_MOCKS) return mockApi.listProjects();
  return realFetch<Project[]>("/api/projects");
}
```

If your backend conforms to that contract, the frontend doesn't change.

## Folder map

```
src/
├── main.tsx                # Entry: QueryClient + Router + Toaster
├── router.tsx              # All 8 routes
├── components/
│   ├── ui/                 # shadcn-style primitives (Button, Input, Card, …)
│   ├── composer/           # PromptComposer (the hero component)
│   ├── project/            # StatusBadge, ProjectCard, ProgressRing
│   └── layout/             # MarketingLayout, AppLayout (sidebar + auth gate)
├── routes/
│   ├── LandingPage.tsx       # /
│   ├── LoginPage.tsx         # /login
│   ├── RegisterPage.tsx      # /register
│   ├── DashboardPage.tsx     # /dashboard
│   ├── CreatePage.tsx        # /create
│   ├── ProjectListPage.tsx   # /projects
│   ├── ProjectDetailPage.tsx # /projects/:id  (polls status every 2s)
│   ├── DownloadPage.tsx      # /projects/:id/download
│   ├── BillingPage.tsx       # /billing
│   └── NotFoundPage.tsx      # *
├── lib/
│   ├── api.ts              # Mock/real fetch switch
│   ├── queries.ts          # TanStack Query hooks
│   └── utils.ts            # cn(), formatRelativeTime, etc.
├── mocks/
│   └── db.ts               # In-memory store (uses sessionStorage)
├── types/
│   └── index.ts            # Shared TypeScript types
└── styles/
    └── globals.css
```

## Design tokens

All colors live in `tailwind.config.ts`:

| Token | Hex |
|---|---|
| `bg-bg` | `#0a0a0a` |
| `bg-surface` | `#141414` |
| `bg-surface-2` | `#1f1f1f` |
| `bg-surface-3` | `#2a2a2a` |
| `border-border` | `#262626` |
| `text-muted` | `#9ca3af` |
| `text-faint` | `#6b7280` |
| `bg-accent` | `#8b5cf6` |
| `text-accent-soft` | `#a78bfa` |

Font: **Geist** (loaded from Google Fonts in `index.html`).

## What's wired up

- ✅ Auth (mock-based, signup gives 30 credits)
- ✅ Landing page matching the reference image
- ✅ Prompt composer with all chips, model picker, magic wand
- ✅ Dashboard with stats and recent projects
- ✅ Project creation flow → routes to detail page
- ✅ Detail page polls every 2s, animates status through the pipeline
- ✅ Scene plan rendering
- ✅ Download page with format selector + share link
- ✅ Project list with filters and search
- ✅ Billing with three credit packs and full transaction history
- ✅ Sidebar with persistent credit display
- ✅ Logout, 404, empty states, loading skeletons
- ✅ Toast notifications

## What it doesn't include (backend's job)

- Real Remotion rendering — the worker handles that
- Stripe webhook completion
- Actual AI calls (OpenAI / fal.ai)
- S3 presigned URLs for asset upload (frontend has the dropzone UI, awaits backend)

## Next steps

1. Wire your Express backend to the contract in `src/lib/api.ts`
2. Flip `VITE_USE_MOCKS=false`
3. Ship
