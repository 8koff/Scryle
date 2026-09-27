# Scryle

**See it before you buy it.** Scan an outfit, a car or a room, tap any part, and swap it for a real product you can
buy. An AI model draws the result first.

Live at **https://scryapp.io**.

## Quick start

```bash
npm ci
cp apps/web/.env.example apps/web/.env.local
npm run dev --workspace web
```

Then open http://localhost:3000. Run all checks with `npx turbo run typecheck test`.

## Docs

| File | For |
|---|---|
| [`ONBOARDING.md`](ONBOARDING.md) | New collaborators: what the app is, how the code is laid out, setup, rules |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to open a good pull request |
| [`SECURITY.md`](SECURITY.md) | How to report a security problem (privately) |
| [`HANDOFF.md`](HANDOFF.md) | Detailed log of recent work and decisions |
| [`AI_RULES.md`](AI_RULES.md) | Hard limits every AI coding assistant must follow here |
| [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) | Team norms |
| [`LICENSE`](LICENSE) | All rights reserved: public to read, not to reuse. Only invited collaborators contribute |

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Vitest · Turborepo · Supabase · Stripe · Anthropic · Higgsfield ·
SerpApi
