# Scryle for iPhone (Expo)

The App Store app. It calls the same API routes as `apps/web` (the server reads only
`Authorization: Bearer <Supabase access token>`) and shares `@retrofit/core` with it.

## Run it

1. Copy `.env.example` to `.env.local` and fill in the two Supabase values (the same public ones the web uses).
2. From this folder:

   ```bash
   npx expo start
   ```

3. Open the QR code with the Expo Go app on the iPhone. Apple sign-in needs a development build (below).

## Development build (Apple sign-in, in-app purchase)

EAS builds the iOS app in the cloud, so no Mac is needed:

```bash
npx eas-cli@latest build --profile development --platform ios
```

## Checks

```bash
npx tsc --noEmit
```

```bash
npx jest
```

```bash
npx expo lint
```

## Native startup on iOS 27

SDK 57 needs scene support when built with Xcode 27. The `expo-build-properties` plugin in `app.json`
sets `ios.enableSceneSupport: true`, so a fresh prebuild or EAS build generates the correct startup code.
Keep this setting in source control; hand-editing the ignored `ios/` folder loses the fix on the next build.
The compatible plugin version is recorded in `package.json` and the root lockfile.

After changing this setting, regenerate the native project in your own checkout:

```bash
npx expo prebuild --clean --platform ios
```

This replaces generated files in `ios/`; preserve any local native edits first. Once the app upgrades to
SDK 58, review whether this opt-in can be removed. See [Expo's scene lifecycle guide](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md).

## Things to know

- **Two React versions.** Expo SDK 57 needs React 19.2.3; the web uses 19.2.8. npm keeps ours in
  `apps/mobile/node_modules`, the root `package.json` pins the web's, and `metro.config.js` + `jest.config.js`
  make every `react` import in this app resolve to ours. `npx expo-doctor` warns about the duplicate; that's expected.
  When Expo moves to the web's React version, delete the override and the root pin.
- **Sign-in** is an emailed code or Sign in with Apple. No Google: Apple's rule 4.8 would require Apple sign-in next to it anyway.
  Apple sign-in needs the Apple provider turned on in Supabase with the bundle id `io.scryapp.app` as a client id.
- **Hidden Apple emails.** Someone who hides their email from Apple can't sign in on the website yet (the web has no Apple button).
- **Clothing** is live camera only and asks for 18+, the same as the web. Keep that in the app: the server can't tell a camera photo from an upload.
- Build plan and decisions: see the "iOS app" pull requests.

## App Review demo account: owner setup

Apple's reviewers can't receive email codes, so they sign in with a password ("Use a password" on the sign-in screen).
Only accounts with a password can use it; normal accounts have none.

1. **Supabase → Authentication → Users → Add user → Create new user**: an email you own (for example a `+review`
   address), a long random password, and tick **Auto Confirm User**.
2. **App Store Connect → your app → App Review Information → Sign-in required**: enter that email and password.
3. Add the account's id (Supabase → Authentication → Users → UID) to `REVENUECAT_SANDBOX_ACCOUNTS` in Vercel, so the
   reviewer's test purchase gives a plan. Test purchases from accounts not on that list give nothing. To let the
   reviewer in without buying, also grant the account the `swaps` entitlement in RevenueCat (a promotional plan): it
   gives Starter.
4. After review, change the password or delete the user.

## Subscriptions (RevenueCat): owner setup

The app sells the same plans as the website (Starter, Plus, Pro, monthly or yearly) through Apple, with RevenueCat in
between. The full plan and the owner's decisions are in `docs/plans/subscriptions-revenuecat.md`. Buying doesn't work
in Expo Go; use a development build or TestFlight.

1. **App Store Connect → Agreements, Tax, and Banking**: sign the Paid Apps agreement and add bank and tax details.
2. **Small Business Program**: join it (Apple's fee drops from 30% to 15%; the margins assume 15%).
3. **App Store Connect → your app → Subscriptions**: one subscription group "Scryle" with six auto-renewable
   subscriptions:

   | Product ID | Price |
   |---|---|
   | `io.scryapp.sub.starter.monthly` | $4.99 a month |
   | `io.scryapp.sub.starter.yearly` | $49.99 a year |
   | `io.scryapp.sub.plus.monthly` | $9.99 a month |
   | `io.scryapp.sub.plus.yearly` | $99.99 a year |
   | `io.scryapp.sub.pro.monthly` | $19.99 a month |
   | `io.scryapp.sub.pro.yearly` | $199.99 a year |

4. **RevenueCat**: add the iOS app with its In-App Purchase key, an entitlement `swaps` on all six products, and one
   offering `default`. Point App Store Server Notifications at RevenueCat (its iOS app settings show the address).
5. **RevenueCat → Integrations → Webhooks**: `https://scryle.app/api/revenuecat/webhook`, with the same Authorization
   value as `REVENUECAT_WEBHOOK_AUTH`.
6. **Keys** (names only; values never go in git):
   - App: `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (RevenueCat's public iOS key) in `apps/mobile/.env.local` and in EAS.
   - Vercel: `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`, and `REVENUECAT_SANDBOX_ACCOUNTS` = account ids
     whose test purchases give a plan, comma-separated (the App Review demo account and your own testers). Test
     purchases are free, so nobody else's count.
7. **Users and Access → Sandbox → Test Accounts**: make a sandbox tester to try buying on your iPhone. Put your own
   Scryle account's id in `REVENUECAT_SANDBOX_ACCOUNTS` first, or the test purchase gives nothing.

How it works: Apple charges → RevenueCat records it and calls the webhook → the server re-reads the customer from
RevenueCat and saves the plan → the app asks the server until the plan shows up. Swaps only ever come from the server.
A plan is changed where it was bought (the app sends website plans to the website, and the other way round), so
nobody pays twice. Deleting an account cancels a website plan; an Apple plan can only be cancelled by its owner in
Apple's settings, and both delete screens say so. An upgrade starts a fresh month with the new plan's full swaps.

