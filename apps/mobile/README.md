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
