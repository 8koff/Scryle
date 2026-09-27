## What and why

<!-- One or two sentences. Link the issue: "Closes #123". -->

## How I tested it

<!-- Commands you ran, what you clicked. Screenshots (phone + desktop) for visible changes. -->

## Checklist

- [ ] `npx turbo run typecheck test` passes
- [ ] Lint passes (`cd apps/web && npx eslint app components lib proxy.ts`)
- [ ] Tests added or updated for the change
- [ ] No secrets, keys, personal emails, account ids or real people's photos in the diff
- [ ] New/changed API route: auth check, `zod` validation, rate limit
- [ ] Database change: new numbered migration, RLS on new tables, added to `supabase/setup-all.sql`
- [ ] Paid API calls stay behind the spend cap and fail closed
- [ ] Keeps the product rules in `ONBOARDING.md` section 6 and the limits in `AI_RULES.md`
