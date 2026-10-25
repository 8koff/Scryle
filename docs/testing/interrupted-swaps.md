# Interrupted swap recovery

Source: recommendation 1 in [PRODUCT-REVIEW.md](../../PRODUCT-REVIEW.md).
Branch: `codex/recover-interrupted-swaps`.

## Reproduced failure

Journey: a signed-in person starts a swap; the server accepts it, but the response does not reach the phone. Sending the same intent again should return the original job without another credit debit.

The mocked regression test in `apps/web/lib/server/render-retry.test.ts` sends the same request twice. No external service is called.

Command: `npx --no-install vitest run lib/server/render-retry.test.ts` from `apps/web`.

RED result: one test failed. The provider mock was called **twice**, the two-credit balance became **zero** instead of one, and the second response returned a different job ID. Saved in local checkpoint `2cbd4b7`.

## Implemented behavior

1. The mobile app records a stable request ID before sending a swap request and keeps that ID when recovering from a lost connection.
2. The server atomically claims the pair of account ID and request ID in durable storage before spending a credit. A fingerprint binds the ID to the original request; changed selections using the same ID are rejected.
3. The server saves the outcome, retrying a failed write once. A repeated request returns the saved outcome. An operation still in progress is checked, not submitted again. If both outcome writes fail, the caller still receives its known job; the durable claim remains pending and blocks duplicate submissions.
4. The app recovers known requests after restart and shows their status in My swaps. Older clients without request IDs retain their existing API contract.
5. If the process or provider fails at an ambiguous point, the request stays unresolved rather than being submitted again. Resolving an unknown provider acceptance is distinct from recovering a lost phone response; no unsupported exactly-once guarantee is made.

## Approved protected-file scope

| File | Change |
| --- | --- |
| `supabase/migrations/0011_render_requests.sql` | Add a server-only request table keyed by account and request ID, with a request fingerprint, stored outcome, and timestamps. Enable RLS, add no browser policies, and restrict access to the service role. |
| `supabase/setup-all.sql` | Append the identical migration for fresh installations. |

The owner approved these exact local changes after the RED checkpoint. No existing migration was edited, no live SQL was run, and no deployment was performed. Existing protected credit, authentication, rate-limit, and spend-cap files remain unchanged; the implementation reuses their helpers.

## Acceptance checks

- A response lost after acceptance recovers the same job with one debit and one provider submission.
- Concurrent requests for the same account and request ID have one winner, including separate server instances.
- Another account cannot access or replay the first account's operation.
- Reusing a request ID for changed selections returns a conflict.
- Missing or unavailable durable storage prevents the new request-ID path from spending.
- An in-progress or ambiguously interrupted operation cannot automatically create another paid job.
- Mobile persistence and recovery keep requests separated by account and survive process restart.
- Legacy clients, server safety validation, rate limits, and spending caps retain their existing behavior.

## Verification evidence

The source implementation is complete locally. Automated providers and HTTP boundaries are mocked throughout.

| Guarantee | Test target | Type and evidence |
| --- | --- | --- |
| Lost start responses replay one job with one debit, including when the first attempt used the last credit | `apps/web/lib/server/render-retry.test.ts` | Handler integration: original RED made two submissions; current GREEN tests cover starting balances of one and two. |
| Unavailable durable storage cannot start paid work; uncertain provider acceptance preserves the claim, credit and spend reservation | `apps/web/lib/server/render-retry.test.ts` | Handler integration: no submit on unavailable storage; one submit across an ambiguous retry. |
| Concurrent callers share one claim; changed picks conflict; accounts are isolated; unresolved outcomes are never reclaimed | `apps/web/lib/server/render-requests.test.ts` | Unit tests for orchestration and the memory test adapter. |
| The database adapter uses insert/conflict handling and owner-scoped reads/updates; corrupt or unavailable data fails closed | `apps/web/lib/server/render-requests.test.ts` | Real Supabase client with mocked HTTP: also checks distinct adapter instances and completion after a lost write response. This is not a live Postgres concurrency test. |
| Recovery requires sign-in, validates IDs, respects the read limit, and sends no-store responses | `apps/web/app/api/render/requests/[id]/route.test.ts` | Route integration with mocked dependencies. |
| The app persists before POST, recovers after process restart, checks without background POSTs, and isolates accounts | `apps/mobile/src/lib/render-requests.test.ts` | Mobile unit tests with persistent storage shared across simulated process restarts. |
| Broken storage or a server without recovery support prevents a paid mobile start | `apps/mobile/src/lib/render-requests.test.ts`, `apps/mobile/src/lib/render.test.ts` | Mobile unit and wiring tests; the original wiring test failed before implementation. |
| Concurrent status responses cannot move a completed swap back to running | `apps/mobile/src/lib/render-requests.test.ts` | Additional runtime RED: expected `ready`, received `running`. GREEN after making terminal states stable. |

Final automated checks on October 4, 2026:

- `npx --no-install turbo run typecheck test`: **6/6 tasks passed**. Web **410**, mobile **81**, core **46** tests (537 total). Core test/typecheck results were cached from the preceding successful full run. Web typecheck includes `next typegen`.
- `npx --no-install eslint app components lib proxy.ts` from `apps/web`: passed.
- `npx --no-install eslint src` from `apps/mobile`: passed.
- `git diff --check`: passed. The normalized SQL in migration 0011 exactly matches the suffix appended to `setup-all.sql`.
- Mobile coverage command: `npx --no-install jest src/lib/render-requests.test.ts src/lib/render.test.ts --runInBand --coverage --collectCoverageFrom=src/lib/render-requests.ts --coverageDirectory=<local-artifact-directory> --coverageReporters=text --coverageReporters=json-summary`. **26 tests passed**, recovery engine coverage: **87.16% statements, 82.94% branches, 84.37% functions, 98.09% lines**.
- Server coverage percentage is unmeasured: the Vitest coverage provider is not installed, and no dependency was added. Passing tests do not establish live database or provider behavior.

Checkpoint evidence: RED is local commit `2cbd4b7`, reachable on `codex/recover-interrupted-swaps`. The subsequent `fix: recover interrupted swaps without duplicate submissions` commit contains the GREEN implementation and this report. Preserve this RED/GREEN evidence if the branch is squashed.

## Release order and remaining checks

1. **The owner must run migration `0011_render_requests.sql` on production before releasing the updated API and iOS client.** Only the owner applies live SQL and deploys. The table has RLS enabled, no browser policies, and only service-role select/insert/update grants.
2. Deploy the API, then release the iOS client. The new client first checks the recovery endpoint; it refuses to submit to an older server without that capability. Existing clients without request IDs retain their old behavior.
3. Run device acceptance checks against an isolated test backend: lose the start response, kill/reopen the app, check My swaps, recover after using the last credit, double-tap, background/foreground, switch accounts, and intentionally make another completed swap. Verify one provider call and debit for each request ID.
4. Verify table grants/RLS and unique-constraint concurrency against a local or isolated Postgres instance. Neither `psql` nor Docker is available here. SQL was reviewed but has not been executed.

Known limits:

- This covers render starts. Scan idempotency and restoring unfinished photo edits remain separate work.
- If a process dies after a claim, provider acceptance is uncertain, or both outcome writes fail and the phone also loses the response, the request can remain pending. It requires owner reconciliation; the app does not guess, refund, or resubmit automatically. An uncertain submission can retain its credit and reserved spend until investigated.
- Recovery records are scoped to the signed-in account on this device. This is not cross-device recovery or a background task/push-notification service. Foreground, My swaps focus, and explicit checks recover known requests.
- Device UI, live database behavior, and paid-provider integration have not been tested. No production settings, paid calls, or new dependencies were used.
