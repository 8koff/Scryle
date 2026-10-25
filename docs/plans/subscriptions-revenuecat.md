# Plan: subscriptions with RevenueCat

Status: **phases 1–3 (server, iPhone app, website) built on `feat/ios-app`, not merged or live.** Phase 4 (Terms, Privacy, invites, docs) not started. Written 2026-10-09 for the owner to review before any code. Every file marked
**(protected)** is in `AI_RULES.md` section 2 and needs the owner's yes before it changes.

## 1. What the owner decided

| Question | Decision |
|---|---|
| Packs or subscriptions | **Subscriptions only.** The one-off packs are no longer sold. |
| What a plan gives | **A monthly swap allowance that resets each month.** Unused swaps don't roll over. |
| Where it's sold | **iPhone app (Apple) and website (RevenueCat Web Billing on Stripe)**, one subscription for both. |
| Plans | The three current tiers, each monthly or yearly (prices below, confirmed 2026-10-10). |
| Free swap | **Removed.** New accounts get nothing until they subscribe. |
| Paywall | **Hard paywall in the app**: after sign-in, nothing but the plans screen until there's an active plan. **Our own design**, not RevenueCat's hosted paywall. |
| Trial | **None.** |
| Swaps | **Only the monthly allowance counts.** Old ledger credits (welcome, invite, packs) are no longer spendable. |

### Plans

| Plan | Swaps / month | Monthly | Yearly (proposed) |
|---|---|---|---|
| Starter | 25 | $4.99 | $49.99 |
| Plus | 60 | $9.99 | $99.99 |
| Pro | 150 | $19.99 | $199.99 |

Yearly is 10× monthly (about 17% off, "two months free"), confirmed by the owner. A yearly plan
still gives its allowance **per month** (12 resets a year), so a yearly Pro member can't spend 1,800 swaps in week one.

Rough worst-case margin per month if every swap is used (AI cost ~7¢ per swap; Apple keeps 15% under the Small
Business Program):

| Plan | Apple, after fee | AI cost at full use | Margin |
|---|---|---|---|
| Starter | $4.24 | $1.75 | ~$2.49 |
| Plus | $8.49 | $4.20 | ~$4.29 |
| Pro | $16.99 | $10.50 | ~$6.49 |

On the web, Stripe takes about 2.9% + 30¢ instead of Apple's 15%, so web margins are higher. RevenueCat itself is free
up to $2,500 monthly tracked revenue, then 1% (check the current pricing page; Web Billing needs a plan that includes it).

## 2. How it works

**The Supabase database stays the source of truth for swaps.** RevenueCat only says who is subscribed to what. The
server turns that into swaps; the app and website never add swaps themselves (same rule as today).

```
Apple / Stripe ──► RevenueCat ──webhook──► /api/revenuecat/webhook ──► subscriptions table
                                                                         │
           scan / render ──► spend_swap() ──► this month's allowance first, then old credits
```

- **One account everywhere.** RevenueCat's "app user id" is the Supabase user id. The app calls
  `Purchases.logIn(userId)` after sign-in and `logOut()` on sign-out; the website does the same with purchases-js.
  That's what makes a subscription bought on the iPhone work on the website and the other way round.
- **Allowance, not ledger rows.** A new `swap_allowance` row per user per month holds `granted` and `used`. Last
  month's row simply stops counting when the month ends, which is the "no rollover" rule with nothing to delete.
- **Only the allowance is spent.** `credit_ledger` rows stay in the database as history (nothing is deleted, `AI_RULES`
  1.5), but swaps come only from this month's allowance. This is safe because no real money has bought packs yet:
  Stripe is still in test mode (HANDOFF) and the app isn't on the App Store. **Owner to confirm before phase 1.**
- **No free swap.** The server stops calling `grantWelcome()`; the old function and index stay (migrations are never
  edited).
- **Months for yearly plans** are counted from the subscription's start date. The current month's row is created the
  first time it's needed (balance check or spend), so no new cron job is required.
- **Upgrades** (e.g. Starter → Pro) apply at once. Apple refunds the unused part of the old plan and starts a new
  billing period, so the new plan starts a fresh month with its full allowance; what was used on the old plan isn't
  carried over (owner's choice, 2026-10-19). **Downgrades** apply at the next renewal, as Apple and Stripe already do.
- **Promotional plans** (granted in RevenueCat's dashboard, e.g. for App Review's demo account) give Starter (owner's
  choice, 2026-10-19).
- **Cancelling** keeps the plan until the period ends (RevenueCat `CANCELLATION`), then `EXPIRATION` stops new
  allowances. **Refunds** end the plan and take back what's left of the current month's allowance.

## 3. Changes, by phase

### Phase 1 — server (no visible change)

| Change | Files |
|---|---|
| Migration `0012_subscriptions.sql`: tables `subscriptions` and `swap_allowance` (RLS on, no browser policies), functions `swap_balance` and `spend_swap`, refunds that give the swap back to its month (no event table: every event re-reads RevenueCat, so duplicates are harmless) (`security definer`, `search_path = ''`, `service_role` only), and an `allowance_month` column on render ledger rows | `supabase/migrations/0012_subscriptions.sql`, `supabase/setup-all.sql` **(protected)** |
| Spending: allowance first, then old credits; a refund goes back to the bucket it came from | `apps/web/lib/server/credits.ts` **(protected)**, `spend.ts` untouched |
| Plan table: product id → tier → swaps per month, shared by server and app | `packages/core/src/credits.ts` **(protected)** |
| Webhook: checks the `Authorization` header, ignores events it has seen (RevenueCat delivers at least once), ignores unknown event types, then re-reads the customer from RevenueCat's REST API before changing anything | `apps/web/app/api/revenuecat/webhook/route.ts` (new), `apps/web/lib/server/subscriptions.ts` (new) |
| Balance API returns plan, allowance left, renewal date | `apps/web/app/api/credits/route.ts` |
| Tests for every path above, with RevenueCat and Supabase mocked | `*.test.ts` next to each file |

### Phase 2 — iPhone app

**Hard paywall:** `app/_layout.tsx` gets a second guard next to `isSignedIn`. Signed in without an active plan, the
only screens are the paywall and Account (sign out and delete account must stay reachable: Apple requires account
deletion to be available). The plan status comes from our own `/api/credits`, so the server, not the phone, decides.

| Change | Files |
|---|---|
| Add `react-native-purchases` (+ `react-native-purchases-ui` only if we use RevenueCat's paywall), remove `expo-iap`; needs a new native build | `apps/mobile/package.json` **(protected)**, `package-lock.json` **(protected)** |
| Replace Apple consumable buying with RevenueCat: configure, `logIn`/`logOut`, offerings, purchase, **Restore purchases** | `apps/mobile/src/lib/purchases.ts` (rewritten), `use-account.ts` |
| Buy screen becomes the plans screen: monthly/yearly switch, three plans, "N swaps a month", renewal note, Restore, Terms and Privacy links (Apple requires these on a subscription paywall) | `apps/mobile/src/app/buy.tsx` |
| Home pill and Account show "Pro · 112 of 150 left · renews Nov 3"; Account gets **Manage subscription** (opens Apple's page) | `swaps-left.tsx`, `(tabs)/account.tsx` |
| Delete account tells people to cancel their Apple subscription too (deleting the account can't cancel it) | `(tabs)/account.tsx` |

### Phase 3 — website

| Change | Files |
|---|---|
| Add `@revenuecat/purchases-js`; plans on the pricing section and in the buy sheet | `apps/web/package.json` **(protected)**, `components/home/pricing*.tsx`, `components/account/buy-sheet.tsx` |
| Retire Stripe Checkout for packs (keep the Stripe webhook a while so refunds of old pack purchases still work) | `apps/web/app/api/checkout/**` **(protected)**, `lib/server/checkout.ts` **(protected)** |
| Allow RevenueCat and Stripe in the Content Security Policy | `apps/web/lib/security/csp.ts` **(protected)** |
| Retire the Apple consumable routes once no app build uses them (the app isn't on the App Store yet, so likely at once) | `apps/web/app/api/apple/**` |

### Phase 4 — words and rules

| Change | Files |
|---|---|
| Terms: auto-renewal, cancelling, no rollover, refunds via Apple or Stripe | `apps/web/app/terms/**` **(protected)** |
| Privacy: RevenueCat as a processor | `apps/web/app/privacy/**` **(protected)** |
| Invites: reward on the friend's **first subscription** instead of first pack | `apps/web/lib/server/invites.ts`, invite copy in app and web |
| Docs: README, ONBOARDING, HANDOFF, `apps/mobile/README.md` | docs |

## 4. Owner setup (only the owner can do these)

1. **RevenueCat:** create the account and a project with an iOS app and a Web Billing app. Check that the plan includes
   Web Billing.
2. **App Store Connect:** one subscription group "Scryle" with six auto-renewable subscriptions
   (`io.scryapp.sub.starter.monthly`, `…starter.yearly`, `…plus.monthly`, `…plus.yearly`, `…pro.monthly`,
   `…pro.yearly`). Add the In-App Purchase key to RevenueCat and point App Store Server Notifications at RevenueCat.
3. **Stripe:** connect it to RevenueCat Web Billing and create the same six prices.
4. **RevenueCat:** an entitlement `swaps`, the six products, one offering `default`; webhook URL
   `https://scryle.app/api/revenuecat/webhook` with a long random Authorization value.
5. **Keys** (names only; values never go in git):
   - App `.env.local` and EAS: `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (public SDK key).
   - Vercel: `NEXT_PUBLIC_REVENUECAT_WEB_KEY` (public), `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_WEBHOOK_AUTH` (server
     only).
6. **Production database:** run `0012_subscriptions.sql` after phase 1 is merged.
7. **Testing:** a sandbox tester in App Store Connect, Stripe test mode, RevenueCat sandbox. On this Mac's simulator a
   StoreKit configuration file can stand in for App Store Connect.

## 5. App Review notes for a hard paywall

- The paywall must show each plan's price and period, what it includes ("25 swaps a month"), that it renews
  automatically until cancelled, **Restore purchases**, and links to Terms and Privacy.
- Apple's reviewers need to get past the paywall: the App Review demo account should get a **promotional entitlement**
  in RevenueCat (free, granted from the dashboard), or reviewers buy with a sandbox account.
- Sign out and Delete account stay reachable without a plan.

## 6. Open questions

1. **Invites:** they used to give both people 2 free pictures as credits, which no longer count now that only the monthly
   allowance is spent. Invite panels are hidden in the app and on the website (the code and invite links still work)
   until the owner picks a reward, e.g. extra swaps added to the current month, or a free first month via a RevenueCat
   promotional entitlement.
2. **Terms and Privacy** still describe packs and the free picture (phase 4).

## 7. Sources

- RevenueCat Expo install: https://www.revenuecat.com/docs/getting-started/installation/expo
- RevenueCat Web overview: https://www.revenuecat.com/docs/web/overview
- Web Billing fees and Stripe: https://www.revenuecat.com/docs/web/integrations/stripe
- Pricing: https://www.revenuecat.com/pricing
- Webhooks: https://www.revenuecat.com/docs/integrations/webhooks
