# Scryle (formerly Scry, Revibe): session handoff (2026-09-26)

Working notes for whoever picks up next (people or AI coding sessions). New here? Read
[`ONBOARDING.md`](ONBOARDING.md) first; this file is the detailed log of recent work and decisions.

This repo is public. Account details (emails, dashboard ids, project refs, billing) live with the owner, not here.
Never add them to this file or any other tracked file.

## Repo made ready for collaborators (2026-09-27)

- Account details removed from this file. Added `README.md`, `ONBOARDING.md`, `CONTRIBUTING.md`, `SECURITY.md`,
  `CODE_OF_CONDUCT.md`, `.nvmrc` (Node 24), GitHub CI (`.github/workflows/ci.yml`: typecheck, test, lint, build with
  no secrets; actions pinned to commit SHAs), Dependabot, and issue/PR templates.
- Security review before going public: no critical or high findings. Added an HSTS header (`SECURITY_HEADERS` in
  `lib/security/csp.ts`). `npm audit --omit=dev`: 0 vulnerabilities.
- `.env.example` now lists every variable (`CRON_SECRET`, `ADMIN_EMAILS`, affiliate ids added).

## 0. Store search session (2026-09-26, later)

The user chose: **store shop** (not people-to-people selling) with **live search** (SerpApi Google Shopping).
Built, tested, reviewed (code + security review, all findings fixed). **Live since 2026-09-26.**
- Migration 0009 run on production (tables checked). SerpApi **Free Plan** key in `.env.local` and Vercel production.
- One real test search (local dev, room "sofa"): 12 real products saved.
  Check usage for free (no search used): SerpApi's `account.json` endpoint (read the key with awk; never print it).
- "Buy" tested (2026-09-26): Ashley sofa → ashleyfurniture.com product page, on local and live; second tap uses no
  search. west elm sofa: Google had no store list → Google's product page (now remembered, so no repeat search).
  Links carry no referral tag yet (no Amazon/Skimlinks ids), so no commission until those accounts exist.
- Not tested yet: a render with a found product (paid, ~3¢).
- Free plan's commercial-use terms are unclear; Starter is $25/month for 1,000 searches.
- Also changed: `formatUsd` now adds thousands commas ("$2,799.99").

How it works:
- Studio part → `POST /api/shop/search` with the signed scan claim → words built server-side from the scan
  (`lib/server/shop/query.ts`: part term, car make/model/year, clothing fit, optional typed words) → saved search
  (24 h) or a new SerpApi call → clothing results with swimwear/underwear words dropped → products saved in
  `shop_products` (id `live-<20 hex>`), only public fields sent to the browser.
- Budget: `SHOP_SEARCH_DAILY_CAP` new searches/day for everyone (default 12, a bit over the free 250/month; user's
  choice "free now, pay later") and 8/day per visitor, both fail-closed. Identical searches at the same time share
  one call (browser and server). Upgrade to Starter ($25/month, 1,000) before real users, then set the cap to ~33.
- Pick a found product → render copies its Google thumbnail to Higgsfield (`render-assets.ts`, host allowlist in
  `lib/shop/live.ts`); store titles are cleaned before the prompt (`promptTitle`, `withoutSteering`).
- `/go/<live-id>`: first tap looks up the store's own link (SerpApi immersive product API, 1 search, then kept),
  adds the referral tag, else falls back to Google's product page.
- Browser keeps picked products in `retrofit:shop-seen` (`lib/shop/seen.ts`) for the cart and "Shop this look";
  `/api/shop/products?ids=` loads ones from shared links or other devices.
- Privacy (SerpApi row) and Terms (live search, listed prices, render may differ) updated.
- Local `next build` was NOT run (another session's `next dev` was using the folder); Vercel's build passed.

Studio shop redesign (same day, user's choice "follow picks", no AI stylist):
- After a scan, every part gets a row (`components/studio/part-row.tsx`); the first 3 shoppable parts
  (`AUTO_ROWS` in `studio.tsx`) load store products at once, the rest on "Show products" or a tap on the photo.
- Picking or searching sets style words (`styleWordsFrom` in `lib/shop/terms.ts`: colours, woods/metals, style names);
  unpicked rows then search "<style> <part>"; if that fails (budget), they fall back to the plain part search.
  A picked row keeps the words that found its pick (`pickedWords`). Looks set the style from their name.
- Search box for any item (`shop-search.tsx`): `partForQuery` guesses the part from the words (other names like
  couch→sofa, rims→wheels); chips move it to another part. "Use words" keeps the described swap (not for clothing).
- Picks tray (`picks-tray.tsx`) above the render button; up to 6 picks (server limit). `options-panel.tsx` removed.
- Style only reaches the first 3 rows and the tapped part (review fix), so one pick costs at most ~3 searches.
- Deployed 2026-09-26 ~22:40 with the Scry name (user said keep it); live at https://scryapp.io.
- `BASE_TERMS` moved to `lib/shop/terms.ts` (shared by server and browser).
- Fixed: studio grid is `grid-cols-1` / `minmax(0,1fr)` so long product rows can't widen the page on phones.
- Deploy note: a deploy uploads the whole folder, including other sessions' unfinished work. The 22:03 deploy put the
  Scry rename and the 6-digit sign-in live early; the user said to keep Scry live.

## 1. Where we stopped (start here)

The site is **live** at **https://scryapp.io** (dark theme, "Seam" logo, deployed 2026-09-26).

Open items (owner):
1. The logo was chosen "for now" (section 7); expect it to change.
2. **Live end-to-end test** (costs about 7¢: ~4¢ scan + ~3¢ render), done by the owner with an admin account:
   sign in (tick 18+) → type the 6-digit code from the email (or open its link on the same device) → header shows
   "1 render" → Room → upload a photo **with no people** → pick a look → render → buy a pack with Stripe test card
   `4242 4242 4242 4242` (any future date, any CVC) → toast "25 renders added" → open `/admin`.
   If the sign-in email never arrives: Supabase's built-in sender only delivers to a few addresses (maybe only team
   members) → set up Resend SMTP (section 9).
3. Provider settings to confirm: an Anthropic Console monthly spend limit (backup cap), and Supabase Auth → Email →
   **Confirm Email** on.
4. Legal items postponed: a **contact email** (fill `LEGAL.contactEmail` and `LEGAL.operator` in
   `packages/core/src/brand.ts`) and a **DMCA agent** (copyright.gov, then a "Copyright" section in the Terms).
5. Hosting plan: commercial use (Stripe payments) needs a paid Vercel plan, not Hobby.

## 1a. Rename + domain (2026-09-26, second session)

- App renamed **Scry**, then **Scryle** on 2026-09-27, live (only `BRAND.name` in `packages/core/src/brand.ts`; the site reads it from there). Old names in
  SQL migration comments were left alone. Logo (Seam) unchanged.
- Domain **scryapp.io** is on Vercel and serves the site. Resend DNS records (DKIM `resend._domainkey`, MX + SPF on
  `send`) are live. Only the owner changes domains/DNS (in the dashboard).
- Vercel `NEXT_PUBLIC_SITE_URL` = `https://scryapp.io`.
- **Live sign-in works** (2026-09-27): code email via Resend SMTP from `login@scryapp.io`.
- Production `RENDER_DAILY_CAP_USD` = **5** (owner's choice, 2026-09-27) → scans may book $2.50/day (~50).
  Production `SHOP_SEARCH_DAILY_CAP` = **50**. SerpApi is on the **Free Plan** (250/month). Upgrade before real users.
- **Collaborators: use your own Supabase project.** Never point local dev at the production database: it shares the
  live spend cap and holds real users' data.
- Supabase Custom SMTP is **on** (needed to edit email templates). Resend with `onboarding@resend.dev` only delivers to
  the Resend account's own address; verify `scryapp.io` in Resend for everyone else.

- **Wording (2026-09-27):** every user-facing "render" now says **"swap"** (user's choice: friendlier). Code names,
  DB values (`reason: "render"`), API paths (`/api/render`) and the `/renders` page URL stay as they are.
- **Buy buttons** on the home pricing cards (`components/home/pricing-packs.tsx`): signed out → sign-in → straight
  to that pack's Stripe page. Shared checkout start: `lib/account/checkout.ts` (also used by the buy sheet).

## 1b. Sign-in change (2026-09-26, second session)

- Sign-in is now **email → 6-digit code** (`account.verifyCode` → `supabase.auth.verifyOtp({ type: "email" })`), so it
  works when the email is read on another device. The email link still works as a backup.
- **Needs a dashboard step (user):** Supabase → Authentication → Emails → Templates: add `{{ .Token }}` to
  **"Magic link or OTP"** and **"Confirm sign up"** (new users get the second one). Without it the email has no code.
- `emailRedirectTo` now ends with `/`: a bare origin doesn't match the `<site>/**` allow list and fell back to the
  live Site URL (so local sign-in links opened the live site).
- **Built-in Supabase email: only team addresses, 2 emails per hour for the whole project** (docs, checked
  2026-09-26). "Too many emails" errors come from this. Resend SMTP (section 9) fixes both.

## 2. What happened this session (2026-09-25 → 26)

1. **Legal audit** ("like someone looking to sue me"), then fixes 1, 2, 4, 5, 6, 7, 9 (3 and 8 postponed, see above):
   - People are refused outside Clothing: Claude returns `has_person`; `handleScan` gives no signed token → no render
     (`lib/server/scan.ts`, `lib/server/vision/normalize.ts`, `Pack.capture.allowsPeople`).
   - "Report this picture" on every `/b/<id>`; reports of sexual images or minors hide the link at once; admin sees a
     48-hour countdown with "Delete for good" / "Keep it up" (`lib/server/reports.ts`, `app/api/reports`,
     `app/api/admin/reports/[id]`, `components/share/report-button.tsx`, migration 0008).
   - "After (AI edit)" label on every slider, the share card and share text; downloads are named `revibe-ai-edit-….jpg`.
   - Notice before scan (photo goes to Anthropic + Higgsfield); clothing checkbox includes that consent.
   - Privacy + Terms rewritten for: Higgsfield public links we can't delete, gallery, Google camera model download,
     no AI training, reports, account closing (unused renders are lost).
   - Honest marketing copy (no fit promise, no "shop opens" while the catalog is empty); captions
     "Examples. The demo photos are AI-generated."; link preview says "AI example".
   - **Delete account** in the account sheet: deletes share files, render files, then the user
     (`lib/server/delete-account.ts`, `app/api/account`, `components/account/delete-account.tsx`).
   - Required "I'm 18 or older and agree to the Terms" checkbox on sign-in.
2. **Security audit** ("like someone trying to hack it"): 21 pass, 4 fail, 1 can't tell. All 4 fixed:
   - Scans now book 5¢ each against the daily cap and may use at most **half** of it (`SCAN_COST_USD`,
     `SCAN_CAP_SHARE` in `lib/server/scan.ts`; `tryReserve(usd, { share })` in `lib/server/spend.ts`). With the
     default $2 cap that is ~20 scans/day; raise `RENDER_DAILY_CAP_USD` for more. The 5¢ is an estimate, not measured.
   - Admin needs a **confirmed** email, checked with Supabase on every admin call (`isConfirmedAdmin` in `lib/server/admin.ts`).
   - Scan and render rate limits **fail closed** if the DB errors; others fail open (`failClosed` in `rate-limit.ts`).
   - Instant report hides: 3 per visitor per day (`reportHideLimit` in `services.ts`).
   - Accepted: sign-in token in `localStorage` (behind the strict CSP). Later fix: cookie sessions with `@supabase/ssr`.
3. **Deployed to Vercel** (section 4).
4. **Redesign:** dark theme, hero layout fix (width no longer depends on window height), Seam logo everywhere.

## 3. How to run and check

```bash
npm install
npm run dev --workspace web        # http://localhost:3000 ("web" preview in .claude/launch.json)
npx turbo run test typecheck       # all tests + types (typecheck runs `next typegen` first)
cd apps/web && npx eslint app components lib proxy.ts
cd apps/web && npx next build      # production build
```

- Last full run (2026-09-26, after store search): **367 tests pass** (41 core, 326 web), types and lint clean.
  The sharp image tests (`share.test.ts`, `collage.test.ts`) can time out when the dev server is busy; they pass alone.
- Git: `main` is the default branch. Work on a branch and open a pull request (see `CONTRIBUTING.md`).
- A local dev server ("web" preview, port 3000) may still be running from another session. **Ask before stopping any process.**

## 4. Live site and deploy

Only the owner deploys production. Collaborators never need production keys: use your own dev accounts (`ONBOARDING.md`).

- Vercel project with Root Directory `apps/web` (set in the dashboard; the CLI can't set it), framework Next.js.
  Linked from the **repo root** (`.vercel/`, git-ignored).
- **Deploy** from the repo root (not `apps/web`): `npx vercel@latest deploy --prod --yes --scope <team>`.
  Takes ~2 minutes. Afterwards check `/`, `/terms`, `/icon`, and that `/api/cron/sweep` answers 404 without the secret.
- `.vercelignore` (repo root) keeps `.env*`, `node_modules`, `.next`, `.smoke`, `.claude`, `apps/web/scripts` and
  `HANDOFF.md` out of the upload. **Without it the CLI uploads everything, including `.env.local`.**
- Server env vars must stay listed in `turbo.json` `passThroughEnv` (Turbo strict mode hides unlisted ones from the build).
- `vercel link` writes a repo-root `.env.local` holding only `VERCEL_OIDC_TOKEN`; it is git- and vercel-ignored.
- Env vars (production) are set in Vercel. Add or change one without printing it:
  `printf '%s' "$VALUE" | npx vercel@latest env add NAME production --scope <team> --force`
  (values read from `apps/web/.env.local` with `awk`, never echoed). Then redeploy (NEXT_PUBLIC_* are baked in at build).
- **Supabase URL Configuration:** Site URL = the live site; Redirect URLs = `<live site>/**` and `http://localhost:3000/**`.
- **Stripe** is test mode. One webhook endpoint → `<live site>/api/stripe/webhook` with 4 events:
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`,
  `charge.dispute.created`. Its secret is `STRIPE_WEBHOOK_SECRET` in Vercel. Live mode needs a new endpoint + key.
- Daily cron `/api/cron/sweep` (`apps/web/vercel.json`), secured by `CRON_SECRET`.
- Harmless build warnings on Vercel: npm "install-scripts not covered by allowScripts" (esbuild, unrs-resolver) and
  Turbopack "Dynamic filesystem access causes tracing of the whole project".

## 5. Hard rules from the owner (do not break)

1. **Money:** price every paid API run exactly first (`npm run smoke -- ... --dry-run`), show the number, get a clear
   **yes**, keep the `--max-usd` cap. Cheapest settings by default. A wrong guess once cost ~$5.
2. **Design must never look AI-made or like Apple.** Banned: lime/neon, `WORD · WORD · WORD` mono caps labels,
   sans + serif-italic accent word, generic big left-aligned slogan heroes, glow blobs, plain colourless pages,
   famous-brand blues (cornflower = Discord, royal/azure = Meta), iPhone-mockup heroes, centered headline + two pills +
   big empty space. **Show real screenshots for big visual choices** (Edge headless, section 10).
3. Product questions to the owner: **2 options + a recommendation**, in plain words. If a question is dismissed,
   stop and wait; don't proceed.
4. **Explain why** each setup step is needed and use the dashboard's *current* wording. Check real docs first; never
   guess button names.
5. Safety: clothing = live camera only, 18+ confirm, no swimwear/underwear, face/body never changed, no free-text swaps
   for clothing. No people in other categories (enforced server-side).
6. **Never delete customers' photos or renders**, except when they close their account (Delete account button).
7. **Never invent products or prices.** `apps/web/lib/catalog/products.json` stays empty until real products are added.
   Live search results are real store listings; show them as the store listed them.
8. **No refunds:** all sales are final, except where the law requires it.
9. **Never print secrets.** Inspect `.env.local` with `awk` (names only).

## 6. Accounts and keys

Local keys: `apps/web/.env.local` (git-ignored). Production: Vercel env vars.

| Var | Local | Vercel (production) |
|---|---|---|
| `HF_API_KEY_ID` (combined `id:secret`) | set | set |
| `ANTHROPIC_API_KEY` | set | set |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | set | set |
| `STRIPE_SECRET_KEY` (**test mode**) | set | set |
| `RENDER_SIGNING_SECRET` | set | set (**different** value from local) |
| `CRON_SECRET` | empty | set |
| `STRIPE_WEBHOOK_SECRET` | empty (not needed locally) | set |
| `NEXT_PUBLIC_SITE_URL` | empty | `https://scryapp.io` |
| `ADMIN_EMAILS` | empty | set |
| `AMAZON_ASSOCIATE_TAG`, `SKIMLINKS_PUBLISHER_ID` | empty | empty (links go untagged) |
| `SERPAPI_API_KEY` (Free Plan) | set | set |
| `VISION_MODEL`, `RENDER_MODEL` | unset | unset (defaults `claude-opus-5-5`, `marketing-low`) |
| `RENDER_DAILY_CAP_USD` | set | 5 |
| `SHOP_SEARCH_DAILY_CAP` (new store searches/day, all users; per visitor still 8) | set | 50 |

- **Supabase (production):** all migrations 0001–0009 are run (verified 2026-09-26 by querying each table).
  Set up **Resend SMTP** before real users.

## 7. Key decisions

- **Look (2026-09-26): dark only.** Page `#121110`, surfaces `#1b1a18` / `#252320`, text `#f2efe8`, muted `#a39e93`,
  lines `#34312c`. Denim fills `#4a70b5` (white text 4.9:1). Denim **as text** uses `text-accent-ink` `#98b0dc`
  (8.6:1); a fill can't also be readable text on dark. Only exception: the white button on the denim pricing card keeps
  `text-accent`. Tokens: `apps/web/app/globals.css`. Image colours (icons, link preview, share card): `BRAND` in
  `packages/core/src/brand.ts` (`backgroundColor`, `inkColor`, `mutedColor`, `accentOnDarkColor`, `accentInkColor`).
  Instrument Sans with the semi-condensed `.display` cut.
- **Logo: "Seam"** (the before/after slider: outlined rounded square, right half denim, seam line with a round handle).
  One drawing, `SeamMark` in `apps/web/lib/brand-mark.tsx`, used by the header (`components/brand/logo.tsx`, 30 px mark,
  26 px word), tab/home icons (`BrandMark`), link preview and share card. History: first 2 square options (Seam, Frame)
  → user said "I don't like the square idea at all" → shown 2 letter logos (Swapped R, Twin e), dismissed → picked
  Seam "for now". **Expect the logo to be revisited.**
- **Hero:** full-width before/after slider in the `max-w-6xl` column; frame `aspect 4/5` (phone) / `16/9`, capped by
  `max-h` (78svh / 80svh) with `w-full`, so short or zoomed windows crop the photo instead of shrinking the layout.
- **Render model:** Higgsfield `marketing-studio/image` low/1k ≈ $0.019 + $0.009 per input image, ~20 s.
- **Photo reader:** Claude Opus 5.5, structured output, effort `low`, ~4¢ per photo.
- **Pricing (2026-09-27):** 1 free render per account (sign-in required). Starter 25 renders $4.99, Plus 60 $9.99,
  Pro 150 $19.99 ("Best value"). No pack under $4.99 (Stripe's 30¢). User chose to stay on Stripe (others cost the same or more). Invite
  reward 2 + 2 after the friend's first purchase. Renders never expire.
- **Headline:** "See it before you buy it."
- Name: **Revibe** (renamed from Retrofit on 2026-09-25). Internal names (`@retrofit/core`, `retrofit:` storage keys)
  kept on purpose. Company has **no name and no email yet** → pages say "the Revibe team" and "[contact email]".

## 8. What is built

**Core** `packages/core/src/`: 4 packs (clothing, car, room, anything), scene schema (incl. `hasPerson`), edit prompt
builder, render plan, credit packs, `BRAND` + `LEGAL`.

**Database** `supabase/migrations/` 0001–0009 (credits ledger, shares, spend cap + rate limits + reversals + check-ups,
saved renders, gallery + admin stats, invites, part maps, reports + hidden links, store search). `supabase/setup-all.sql` = all of
them joined (rebuild it by concatenating the migration files after a header line).

**Web** `apps/web/`:

| Area | Files |
|---|---|
| Home: hero slider + swap chips → "More swaps" wall → gallery → how it works → categories → pricing → footer | `app/page.tsx`, `components/home/*`, `lib/demo.ts`, `public/demo/*` |
| Before/after slider ("After (AI edit)" label) | `components/ui/compare-slider.tsx`, `components/ui/hud-box.tsx` |
| Scan (camera, upload except clothing, people refused outside clothing, AI-partner notice) | `app/scan/[pack]`, `components/scan/*`, `lib/capture/*`, `app/api/scan`, `lib/server/scan.ts` |
| Studio (looks, parts, render, versions, shop, share) | `app/build/[id]`, `components/studio/*`, `lib/build/*` |
| Accounts (magic link + 18+ checkbox, credits, buy sheet, invites, Delete account) | `components/account/*`, `lib/account/*`, `lib/server/{accounts,credits,delete-account}.ts`, `app/api/account` |
| Stripe (checkout, confirm, webhook) | `app/api/checkout/**`, `app/api/stripe/webhook`, `lib/server/checkout.ts` |
| Renders + My renders + reopen | `app/api/render/**`, `app/api/renders/**`, `app/renders`, `lib/server/{render,renders,keep-render,reopen}.ts` |
| Share links, report button, gallery, admin (reports + gallery + numbers) | `app/b/[id]`, `app/api/{share,shares,reports,admin}/**`, `lib/server/{share,shares,reports,gallery,admin}.ts`, `components/{share,admin}/*` |
| Shop: live store search, cart, `/go/<id>` affiliate redirect (catalog still empty) | `lib/shop/*`, `lib/catalog/*`, `lib/server/shop/*`, `app/api/shop/**`, `app/go/[id]`, `components/shop/*`, `components/studio/{store-results,product-card}.tsx` |
| Terms + Privacy (drafts until `LEGAL.reviewed`) | `app/{terms,privacy}/page.tsx`, `components/legal/legal-page.tsx` |
| Safety: spend cap (scans + renders), rate limits, daily sweep, security headers + nonce CSP | `lib/server/{spend,rate-limit,services,sweep}.ts`, `app/api/cron/sweep`, `proxy.ts`, `lib/security/csp.ts` |
| Icons, manifest, link preview, 404/error | `app/{icon,apple-icon,manifest,opengraph-image}.ts(x)`, `lib/brand-mark.tsx` |

## 9. To do (rough order)

1. Whatever the owner's live test (section 1) shows.
2. **Resend SMTP** in Supabase so sign-in emails reach real users (check current Supabase + Resend docs first).
3. Contact email + company name in `LEGAL`; DMCA agent + Terms section; lawyer check → `LEGAL.reviewed = true`.
4. Paid hosting plan before real sales. If the domain changes, update `NEXT_PUBLIC_SITE_URL`, Supabase URLs and the
   Stripe webhook URL.
5. Store search go-live (section 0). Then: affiliate accounts (Skimlinks/Sovrn, Amazon Associates) so `/go` links
   earn; restore shopping copy on the home page; maybe "Add to cart" before a render. Hand-picked products can still go
   in `products.json` (fields: id, pack, part, title, priceCents, store, buyUrl, image, optional sponsored; https only;
   ids may not start with `live-`).
6. Hero demo images were rendered at 2k (customers get 1k); remaking costs money → price it and ask first.
7. Stripe live mode (restricted key + new live webhook), demo video (`#HiggsfieldApp`), cookie sessions
   (`@supabase/ssr`), security review of saved renders / invites / reopen.
8. Later: wishlist + price alerts, video reveal (paid), Expo phone app.

## 10. Gotchas

- **Next.js 16:** read `node_modules/next/dist/docs/` before Next code; `params` are async; `npx next typegen` after
  adding routes; `proxy.ts` replaces middleware; `error.tsx` gets `retry`.
- Only **one `next dev` per folder**. The dev server has crashed on its own (exit 0xC0000409) while the full test run
  was going; restart it with preview_start `web`. First page compile takes 1–2 minutes on this drive ("Slow filesystem").
- **Screenshots:** the browser pane scales big viewports down and can't zoom a region. Use Edge headless from
  **PowerShell**: `Start-Process msedge --headless=new --screenshot=<scratchpad>\x.png --window-size=W,H
  --force-device-scale-factor=1 --user-data-dir=<scratchpad>\edge-prof --virtual-time-budget=15000 <url> -Wait`.
  Edge headless can't go narrower than ~500 px, so check **phone** layouts in the pane with `resize_window` preset
  `mobile` and measure with `javascript_tool`.
- The owner's Windows scaling is 150%: their Chrome window is about 1237 × 525 CSS px. Test short, wide windows.
- **Bash heredocs** break on backslashes and some content: write scripts with the Write tool, run them with Python.
- Vercel CLI: `project update` needs `--yes`; `whoami --non-interactive` shows login state; device login waits for
  the user to approve a link in the browser and stops if they touch the terminal.
- An element with a CSS animation/transform becomes the containing block for its absolute children → give animated
  wrappers `absolute inset-0`. With `aspect-ratio` + `max-height`, add `w-full` or the browser narrows the box.
- Windows scripts: set `process.exitCode`, never `process.exit()`.
- Two hero room pictures are **mirrored** on purpose. The owner's Chrome has Grammarly (hydration warning silenced on `<body>`).

## Product assessment (2026-10-04)

- Added `PRODUCT-REVIEW.md`: five ranked improvements for the iOS product, with current-code evidence, rough
  effort estimates, first changes, and success checks. Read the newer iOS handoff for the current product direction;
  the older web roadmap above is historical.
- Recommended order: safe recovery after interrupted swaps; examples before sign-in; mobile store-search
  refinement; persistent unfinished edits; invite capture and claiming in iOS. Protected implementation work is
  identified in the report; this session implemented no product changes.
- Verified `npx --no-install turbo run typecheck test`: 6/6 tasks passed; web 389 tests, mobile 64, core 46 (core
  tests and typecheck from cache). Web ESLint passed with no output. Device flows and paid provider quality remain
  unverified; no production changes or paid API calls were made.
- Existing `apps/mobile/tsconfig.json` edits and the untracked `ARCHITECTURE.md` were left in place.

## Interrupted-swap recovery started (2026-10-04)

- Working branch: `codex/recover-interrupted-swaps`. Local checkpoint `2cbd4b7` adds
  `apps/web/lib/server/render-retry.test.ts`. It reproduces a lost-response retry submitting two provider jobs
  and spending two credits. Providers are mocked; no paid run occurred.
- Concrete design, acceptance checks, and RED evidence: `docs/testing/interrupted-swaps.md`.
- Implementation is not complete. The new regression deliberately remains failing; all 499 pre-existing tests
  passed (mobile/core from cache). Web typecheck passed separately; mobile/core typechecks were cached; web lint passed.
- Awaiting the owner's exact-file confirmation for `supabase/migrations/0011_render_requests.sql` and appending
  the same SQL to `supabase/setup-all.sql`. Proposed table stores account-scoped request IDs, fingerprints,
  outcomes, and timestamps with RLS and service-role access only. No protected files have been edited.
- No product code changed yet. Existing uncommitted work remains in place. Nothing was pushed or deployed.

## Interrupted-swap recovery implemented locally (2026-10-04)

- Continues the approved work above. The owner confirmed the exact database source changes: new
  `supabase/migrations/0011_render_requests.sql` and the identical appended SQL in `supabase/setup-all.sql`.
  No live SQL or deployment occurred; protected credit/auth/spend/rate-limit helpers were reused unchanged.
- Mobile persists an account-scoped request ID before starting a swap. The API claims it durably before spending,
  fingerprints its input, and replays known outcomes. GET `/api/render/requests/[id]` recovers an authenticated
  account's request without another paid submission. Legacy callers without IDs retain the existing behavior.
- Foreground and My swaps recover pending requests. My swaps shows checking/running/ready/failed status;
  the studio can check the existing swap even with zero remaining credits. It prevents changing picks during
  an unresolved request. Completed states cannot regress when studio and foreground responses arrive out of order.
- Unknown provider acceptance remains pending and is never automatically retried or reclaimed. Such a request
  can retain its credit and reserved spend until owner reconciliation. This is lost-response protection, not a
  guarantee that every interrupted provider call can be resolved automatically. Scan starts remain separate work.
- Verification: `npx --no-install turbo run typecheck test` passed 6/6 tasks: web 410, mobile 81, core 46 tests
  (537 total; core checks cached). Web and mobile ESLint passed. SQL mirror and `git diff --check` passed.
  Recovery engine coverage: 98.09% lines, 82.94% branches. Detailed RED/GREEN evidence and limits:
  `docs/testing/interrupted-swaps.md`; original RED checkpoint `2cbd4b7`.
- Owner release order: apply migration 0011, deploy the API, then release the iOS client. The client refuses a
  paid start if recovery support is missing. Device acceptance and a real database concurrency/RLS check remain
  unverified (no iPhone, local Postgres or Docker used); provider tests are mocked. No dependency was added.
- This branch remains local. GitHub CLI is unavailable; no PR, push, merge, or release was performed. Existing
  `apps/mobile/tsconfig.json` edits and untracked `ARCHITECTURE.md` are outside this change and remain untouched.
