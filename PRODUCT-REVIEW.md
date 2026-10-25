# Scryle: five product improvements

Assessment date: October 4, 2026 (America/Los_Angeles).
Reviewed local commit: `2154221`, plus the current working tree.

Scryle's strongest promise is specific: choose a real product, see an AI preview on your own photo, then visit the store. The next improvements should help a new iPhone user complete that journey and trust the result.

This is a source-based assessment, not an observed iPhone usability study. I read the four project documents supplied by the owner and checked the relevant mobile and server code. The newer iOS handoff establishes the scope: all four categories remain, iOS is the main product, and web work supports it or fixes bugs. No production settings, paid APIs, or private environment files were accessed. There is no usage or conversion baseline available in this review; expected benefits remain hypotheses.

## Ranked recommendations

Effort estimates are rough engineering time including tests, assuming the existing development setup works. They exclude owner setup, deployment, device availability, and review turnaround. Scores use impact (I), confidence in the opportunity (C), and effort (E), each 1–5; ICE = I × C / E. They express judgment, not measured conversion lift. Reliability is ranked first as a prerequisite even though the smaller onboarding change has the higher score.

| Rank | Improvement | Expected benefit | Rough effort | I / C / E | ICE |
| --- | --- | --- | --- | --- | --- |
| 1 | Make interrupted swaps safe to resume | Protect credits and remove uncertainty after a connection failure | 4–6 days | 5 / 5 / 4 | 6.25 |
| 2 | Show the product before asking for sign-in | Let newcomers understand the value before creating an account | 1–2 days | 5 / 3 / 2 | 7.50 |
| 3 | Let shoppers refine product results | Help users find something they actually want to preview and buy | 2–3 days | 4 / 4 / 3 | 5.33 |
| 4 | Save unfinished edits | Preserve the photo and choices when someone leaves and returns | 2–4 days | 4 / 4 / 3 | 5.33 |
| 5 | Complete the invite journey into iOS | Make the existing referral promise usable within the app | 3–5 days | 3 / 4 / 3 | 4.00 |

### 1. Make interrupted swaps safe to resume

**Implementation update (October 4, 2026).** The render-start recovery described below is now implemented locally on `codex/recover-interrupted-swaps`. See [behavior, tests, and release requirements](docs/testing/interrupted-swaps.md). The evidence below describes the original reviewed state; scan protection and owner deployment remain separate work.

**Evidence.** The studio explicitly warns users to check My swaps before retrying a lost connection, so they do not pay twice ([studio screen](apps/mobile/src/app/studio/%5Bid%5D.tsx), `runRender`, lines 119–130). The server request schema contains no client operation ID; a new accepted request spends a credit and submits a new provider job ([render handler](apps/web/lib/server/render.ts), lines 42, 116, 139). Pending jobs are stored only after the client receives the job ID. Existing restart recovery is useful, but does not close the lost-response gap.

**Change.** Give each intended swap a durable request ID before sending it. Have the server remember the operation and return its existing status on a retry. Show queued, working, ready, or needs-attention entries in My swaps. If provider acceptance is uncertain, reconcile it rather than blindly submitting a second job. Keep the agreed behavior of results waiting in My swaps without push notifications.

**First change.** Reproduce “server accepted the swap, client lost the response” with a mocked provider. Specify and implement the request-ID behavior around that case before changing the retry button. Follow with the equivalent scan protection.

**Success check.** Retrying the same operation or reopening the app never creates a second provider submission or credit debit in the fault-injection cases. The user can find the operation's current state without starting over.

**Implementation boundary.** This likely needs durable server storage and protected payment/database work. Exact protected changes need separate owner authorization under AI_RULES.md; this assessment does not authorize them.

### 2. Show the product before asking for sign-in

**Evidence.** Home and the category pages are all inside the signed-in route guard ([root layout](apps/mobile/src/app/_layout.tsx), lines 95–105). A new user sees a sentence about the product and sign-in choices ([sign-in screen](apps/mobile/src/app/sign-in.tsx), line 59). The interactive before/after examples and shooting guidance already exist on category pages, but are behind that gate.

**Change.** Allow a newcomer to browse the existing four category previews. Ask for sign-in when they choose to use their own photo, then return them to the category they chose. Keep the existing camera, age, consent, credit, and server safety controls. Clearly label the existing examples as AI examples; browsing them should require no scan or render call.

**First change.** Add a “See examples” route from sign-in that reuses the category content. Keep paid and account-specific actions gated.

**Success check.** In observed first-use sessions, can people explain what Scryle does and choose a category without help? Compare completion from first open to first successful swap, not just sign-up count. The impact estimate is less certain than the code finding and should be tested.

### 3. Let shoppers refine product results

**Evidence.** Mobile search sends only the signed photo claim, part, and clothing fit ([store search](apps/mobile/src/lib/store-search.ts), line 67). The studio displays a product row, plain error text, or “No store results for this part”; it has no search refinement or visible retry action ([studio screen](apps/mobile/src/app/studio/%5Bid%5D.tsx), `StoreRow`, line 281). The web UI already supports search words, and the server accepts and validates an optional `words` field ([search handler](apps/web/lib/server/shop/search.ts), line 34).

**Change.** Add an explicit “Search this part” action and useful empty/error recovery. For example, let a Room user refine a sofa search to “green velvet sofa.” Optional price sorting should operate on returned store prices and describe its scope honestly. Preserve the distinction between searching real clothing listings and free-text clothing edits, which remain prohibited.

**First change.** Add a submitted search field for the active part using the existing server validation. Include the submitted words in cache keys, reuse cached results, and avoid issuing a paid search on every keystroke. Keep all search caps and safety filtering.

**Success check.** More search sessions produce a selected real product, fewer end at an unhelpful empty state, and searches consumed per completed swap remain acceptable. Verify that selecting a product still leads to its store page; do not imply that an AI preview guarantees fit or an exact physical match.

### 4. Save unfinished edits

**Evidence.** Scanned builds live in an in-memory Map capped at five entries ([build store](apps/mobile/src/lib/builds.ts), line 17). Current selections live in component state ([studio screen](apps/mobile/src/app/studio/%5Bid%5D.tsx), line 50). The missing-build screen says the photo is closed and directs the user to finished swaps. Restoring a completed swap does not preserve an unfinished editing session.

**Change.** Add an account-scoped draft containing the scan reference, local photo reference, selected products, and active part. Offer “Continue editing” on Home. Validate the existing signed claim when resuming. If it has expired, retain the draft context and explain the next step; do not silently spend money on a new scan or delete the user's photo.

**First change.** Persist one current draft and restore it after an app restart. Handle account changes, missing local files, expired claims, and unavailable products explicitly before expanding to multiple drafts.

**Success check.** After choosing two products, killing and reopening the app restores those choices and the photo without another scan. Signing into a different account never reveals the previous account's draft.

### 5. Complete the invite journey into iOS

**Evidence.** The mobile invite card shares a web URL with `?invite=...` ([invite card](apps/mobile/src/components/invite-card.tsx), line 39). The reviewed mobile code has no incoming invite claim flow; the web handles that through `/api/invites/claim`. App configuration includes a custom scheme but no associated domains. The iOS handoff also identifies the invite gap.

**Change.** Open supported invite links in the installed app, preserve a validated invite code through sign-in, and claim it using the existing server endpoint. For someone who has not installed the app, provide a clear web fallback and a code they can enter after installation. Ordinary universal links should not be presented as automatic attribution through a fresh install. Universal links require both website association and native configuration ([Expo documentation](https://docs.expo.dev/linking/ios-universal-links/)).

**First change.** Implement invite-code capture/entry and claiming, with duplicate and invalid-code cases covered. Then wire the verified HTTPS link into that flow. Validate that an eligible sandbox purchase exercises delivery without triggering real invite rewards, as the current server intentionally suppresses those rewards for sandbox transactions.

**Success check.** An invited tester reaches the app with the correct code preserved through sign-in. Mocked reward tests show the existing first-real-purchase rule is applied exactly once.

**Scope note.** The iOS handoff warns that a separate waitlist branch could redirect shopping/share URLs. The currently inspected proxy has no such redirect. Treat that as a future merge check, not a confirmed bug in this checkout. Domain association and release steps remain owner-operated.

## Suggested starting point

Start with the interrupted-swap acceptance case in recommendation 1. It addresses an explicit warning already shown to users and establishes the recovery behavior before the app reaches more testers. The smallest independent UI improvement is recommendation 2, using existing examples and design tokens.

For the first usability round, record completion and time for: understand the example, choose a category, select a suitable photo, pick a real product, see a completed swap, and open its store listing. Record failed or repeated attempts as well as successful ones. Start with a manual observation sheet; no analytics SDK or tracker is needed. Real scan/render sessions require the separately priced, owner-approved run described in AI_RULES.md.

Server-generated gallery thumbnails are a sensible later optimization: the current thumbnail component still requests `afterUrl`, even though it resizes the decoded image. Measure device loading first. Render quality against the chosen product also needs an approved real-provider check; passing mocked tests cannot establish visual fidelity.

## Verification

- `npx --no-install turbo run typecheck test`: passed, 6/6 tasks. Web: 389 tests; mobile: 64 tests; core: 46 tests from Turbo cache. Core typecheck was also cached.
- `npx --no-install eslint app components lib proxy.ts` from `apps/web`: passed, exit code 0, no output.
- No iPhone interaction, live purchase, live store search, or paid AI generation was performed. No conversion improvements or rendering-quality claims have been measured.
- This deliverable changes documentation only. Existing changes to `apps/mobile/tsconfig.json` and the untracked `ARCHITECTURE.md` were left in place.
