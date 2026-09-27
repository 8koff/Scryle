# Security policy

## Reporting a problem

**Please do not open a public issue, discussion or pull request for a security problem.**

Report it privately through GitHub: open the repository's **Security** tab → **Report a vulnerability**.
Only the maintainers can see the report.

Please include:

- What is affected (route, file, or page) and what an attacker could do.
- Steps to reproduce, or a proof of concept.
- Whether you think it is being used now.

We aim to reply within 3 working days and to fix confirmed problems as fast as their risk needs.
Please give us a fair chance to fix it before you share details publicly.

## Scope

In scope: this repository's code and the live site at https://scryapp.io.

Out of scope: problems in third-party services themselves (Supabase, Stripe, Vercel, Anthropic, Higgsfield,
SerpApi), denial of service by traffic volume, social engineering, and findings that need a compromised device.

When you test, use only your own account and data. Don't access other people's data, don't spend other people's
credits, and don't run paid AI calls in bulk.

## For contributors

- Never commit secrets. They belong in `apps/web/.env.local` (git-ignored) or in the hosting provider.
- If you commit a secret by mistake, tell a maintainer at once. The key must be **rotated** (replaced) at the
  provider; deleting the commit is not enough.
- See `ONBOARDING.md` section 7 for the security rules every change follows.
