# Onboarding: start here

Welcome to Scryle. This guide gets you from a fresh clone to a running app and your first pull request.
Read it top to bottom once (about 15 minutes). After that, [`HANDOFF.md`](HANDOFF.md) is the detailed log of
recent work and decisions, and [`CONTRIBUTING.md`](CONTRIBUTING.md) is the short checklist for pull requests.

## 1. What Scryle is

Scryle is a web app at **https://scryle.app**. You take a photo of something (an outfit, a car, a room, or anything),
tap a part of it (the jacket, the wheels, the sofa), and swap that part for a real product you can buy. An AI model
draws the "after" picture so you can see it before you buy it.

The flow, end to end:

1. **Scan.** The browser takes or uploads a photo. Claude (Anthropic API) reads it and returns the parts it sees,
   with boxes. The server signs that result so it can't be edited in the browser.
2. **Studio.** Each part gets a row of real store products (live Google Shopping search through SerpApi).
   You pick products or type what you want.
3. **Render.** Higgsfield (image model) edits the photo with the picks. Each render costs the user one credit.
4. **Share and shop.** Renders can be shared as a link (`/b/<id>`) and products open the store's page (`/go/<id>`).

Money: 1 free render per account, then credit packs through Stripe (test mode for now).

## 2. The code, in one picture

```
apps/web/          Next.js 16 app: pages, API routes, all server logic
  app/             Routes. app/api/** = API. app/b, app/build, app/scan = main pages
  components/      React components, grouped by feature (studio, scan, account, shop, ...)
  lib/             Logic, grouped the same way. lib/server/** runs only on the server
  scripts/         Paid "smoke" scripts that call the real AI APIs (read section 6 first)
apps/mobile/       Empty slot for a future Expo app
packages/core/     Shared, framework-free code: packs, scene schema, prompt builder, credits, BRAND + LEGAL
supabase/          SQL migrations (0001–0009) and setup-all.sql (all of them joined)
```

Main technologies: Next.js 16 (App Router, `proxy.ts` instead of middleware), React 19, Tailwind 4, TypeScript,
Vitest, Turborepo + npm workspaces, Supabase (Postgres + Auth), Stripe, Anthropic, Higgsfield, SerpApi.

> **Next.js 16 is newer than most docs and AI tools know.** Before you write Next code, read the guide in
> `node_modules/next/dist/docs/`. `params` are async, `proxy.ts` replaces middleware, and `error.tsx` gets `retry`.

Good first files to read:

| To understand | Read |
|---|---|
| The four categories ("packs") and their parts | `packages/core/src/packs/*` |
| How the edit prompt is built | `packages/core/src/render/prompt.ts` |
| Scan (photo → parts) | `apps/web/app/api/scan/route.ts` → `lib/server/scan.ts` → `lib/server/vision/*` |
| Render (parts → picture) | `apps/web/app/api/render/route.ts` → `lib/server/render.ts` |
| Server services, rate limits, spend cap | `apps/web/lib/server/services.ts` |
| Security headers and CSP | `apps/web/proxy.ts`, `apps/web/lib/security/csp.ts` |
| Database and its safety rules (RLS) | `supabase/migrations/*.sql` |

## 3. Set up your computer

You need **Node 24** (see `.nvmrc`) and **npm 11**.

```bash
git clone <repo url>
cd <repo folder>
npm ci
```

Check that everything is healthy **before** you add any keys. None of these need keys or cost money:

```bash
npx turbo run typecheck test
```

```bash
cd apps/web && npx eslint app components lib proxy.ts
```

## 4. Run the app

```bash
cp apps/web/.env.example apps/web/.env.local
npm run dev --workspace web
```

Open http://localhost:3000. The first page compile can take a minute or two.

With an empty `.env.local` you can work on the home page, layout and most UI. Features that call a service need
**your own** keys for it. **Never ask for, and never use, the production keys.** Get free or test accounts:

| Feature you work on | Keys you need in `apps/web/.env.local` | Cost |
|---|---|---|
| Sign-in, credits, shares, gallery, rate limits in the DB | Your own **Supabase** project: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. Run `supabase/setup-all.sql` in its SQL Editor once. | Free tier |
| Signed scans and renders | `RENDER_SIGNING_SECRET` (make one with the command in `.env.example`) | Free |
| Buying credit packs | **Stripe test mode** `STRIPE_SECRET_KEY` (`sk_test_…` only) | Free |
| Scan (reading photos) | `ANTHROPIC_API_KEY` | ~4¢ per photo |
| Render | `HF_API_KEY_ID` + `HF_API_KEY_SECRET` (Higgsfield) | ~2–3¢ per render |
| Store search | `SERPAPI_API_KEY` | Free plan: 250 searches/month |

Without Supabase, rate limits and the spend cap fall back to memory (one server only). That is fine for local work.

## 5. Tests and checks

- `npx turbo run typecheck test` runs all types and tests (about 370 tests). Typecheck runs `next typegen` first.
- Tests sit next to the code: `foo.ts` → `foo.test.ts`. Write the test first when you fix a bug or add logic.
- `cd apps/web && npx next build` is the production build.
- CI (GitHub Actions) runs typecheck, tests, lint and build on every pull request. It must pass before merge.
- The image tests (`share.test.ts`, `collage.test.ts`) can time out on a busy machine. Run them alone if so.

## 6. Rules that protect users and money (do not break)

These are product rules, not style preferences. A pull request that breaks one will not be merged.

1. **Money.** Anything that calls a paid API (Anthropic, Higgsfield, SerpApi) must stay behind the spend cap and
   rate limits in `services.ts`. Price a paid script run first with `--dry-run` and keep the `--max-usd` cap.
2. **Safety.** Clothing = live camera only, 18+ confirmation, no swimwear or underwear, face and body are never
   changed, no free-text swaps for clothing. No people in the other categories. The server enforces this; keep it so.
3. **Never delete customers' photos or renders**, except when they close their account.
4. **Never invent products or prices.** `apps/web/lib/catalog/products.json` stays empty until real products are
   added. Show live store results as the store listed them.
5. **Design must not look AI-made or copy a famous brand.** See the banned list in `HANDOFF.md` section 5.
   For a big visual change, add before/after screenshots to the pull request.
6. **No secrets or personal data in git.** Not in code, tests, docs, commit messages, or screenshots.

> **Using an AI coding assistant?** It must follow [`AI_RULES.md`](AI_RULES.md). Claude Code, Codex, Cursor and
> Copilot pick it up on their own (through `CLAUDE.md`, `AGENTS.md` and `.github/copilot-instructions.md`).
> For any other tool, paste the file into its instructions.

## 7. Security basics for this repo

This repo is public. Assume attackers read every line.

- **Secrets live only in `.env.local`** (git-ignored) or in Vercel. `.env.example` lists names, never values.
- **Server-only code** goes in `apps/web/lib/server/**` and must never be imported by a `"use client"` file.
  Only `NEXT_PUBLIC_*` variables reach the browser.
- **Every API route** checks who is calling, validates input with `zod`, and uses a rate limit from `services.ts`.
  Anything that costs money fails closed (refuses) when a limit can't be checked.
- **Database:** every new table turns on row level security (RLS) in its migration. The browser uses only the
  publishable key; server writes use the secret key.
- **Found a security problem?** Don't open a public issue. See [`SECURITY.md`](SECURITY.md).

## 8. How we work

1. Pick or open an issue. Say in the issue that you're taking it.
2. Make a branch from `main`: `feat/short-name`, `fix/short-name`, or `docs/short-name`.
3. Small commits in the [Conventional Commits](https://www.conventionalcommits.org/) style: `feat: add wishlist`,
   `fix: stop double refunds`.
4. Open a pull request and fill in the template. CI must pass and one maintainer must approve.
5. Database changes: add a **new** numbered file in `supabase/migrations/` (never edit an old one), and add it to
   `supabase/setup-all.sql`. Say in the PR that it needs to be run on production; only the owner does that.
6. Production deploys by itself: Vercel is connected to GitHub, so every pull request merged into `main` goes live.
   Never deploy with the Vercel CLI or from a local folder. A folder can hold unfinished or private work, and a CLI
   deploy uploads all of it. Only the owner merges.

## 9. Glossary

| Word | Meaning |
|---|---|
| Pack | A category: `clothing`, `car`, `room`, `anything` (`packages/core/src/packs`) |
| Part | Something in the photo you can swap (jacket, wheels, sofa) |
| Scene | Claude's reading of the photo: the parts and their boxes |
| Scan claim | The signed scene the server gives the browser, so it can't be faked |
| Look | A ready-made set of picks with a style name |
| Render | One AI "after" picture. Costs one credit. The site calls it a **"swap"**; code, DB and API keep "render" |
| Share | A public link to a render, `/b/<id>` |
| Spend cap | Hard daily dollar limit on paid AI calls (`RENDER_DAILY_CAP_USD`, default $2) |
| Retrofit / Revibe / Scry | Old names of the app. Some internal names (`@retrofit/core`, `retrofit:` storage keys) keep them on purpose |
