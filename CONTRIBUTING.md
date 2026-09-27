# Contributing

**Only people the owner invites can contribute.** Pull requests from anyone else are closed without review.

New here? Read [`ONBOARDING.md`](ONBOARDING.md) first. Using an AI coding assistant? It must follow
[`AI_RULES.md`](AI_RULES.md).

This code is **not open source** (see [`LICENSE`](LICENSE)). By opening a pull request you agree that the project
may use your contribution under the terms in `LICENSE`.

## Before you start

- Look for an open issue, or open one to describe the change. For big changes, agree on the plan in the issue first.
- Security problems: **do not** open a public issue. Follow [`SECURITY.md`](SECURITY.md).

## Making a change

1. Branch from `main`: `feat/…`, `fix/…`, `docs/…`, `refactor/…`, `test/…`, `chore/…`.
2. Write or update tests next to the code (`foo.ts` → `foo.test.ts`). Bug fix = a test that failed before the fix.
3. Run the checks locally:
   ```bash
   npx turbo run typecheck test
   ```
   ```bash
   cd apps/web && npx eslint app components lib proxy.ts
   ```
4. Commit in [Conventional Commits](https://www.conventionalcommits.org/) style: `fix: stop double refunds`.
5. Open a pull request and fill in the template.

## What a pull request needs

- CI is green (typecheck, tests, lint, build).
- One approval from a maintainer.
- Screenshots for any visible change (phone and desktop width).
- For a new or changed API route: auth check, `zod` input validation, and a rate limit.
- For a database change: a **new** numbered migration with row level security on every new table, plus the same SQL
  added to `supabase/setup-all.sql`.
- No secrets, keys, personal emails, account ids or real people's photos anywhere in the diff.
- It keeps the product rules in `ONBOARDING.md` section 6 and the limits in `AI_RULES.md`.
- Files listed in `.github/CODEOWNERS` need the owner's approval.

## Paid APIs

Do not run scripts or tests that call Anthropic, Higgsfield or SerpApi with someone else's keys. Use your own, price
the run first (`npm run smoke -- --dry-run`), and keep the `--max-usd` cap.

## Code style

- TypeScript strict. Small files and functions. Early returns over deep nesting.
- Don't mutate shared objects; return new ones.
- Comments explain *why*, not *what*. Match the style of the file you're in.
- Server-only code stays in `apps/web/lib/server/**`.
