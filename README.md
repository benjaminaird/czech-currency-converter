# Czech Currency Converter

A tiny, mobile-friendly USD / CZK / EUR converter for Vercel. No build tools, dependencies, accounts or API keys. The crowned Czech lion is the application's official logo and app icon.

## Deploy

1. Extract this ZIP.
2. Go to https://vercel.com/new and choose the **Deploy** option for your project (or import the folder into a GitHub repository first).
3. Set the project root to this folder. Choose **Other** as Framework Preset and leave the build command empty.
4. Deploy. Vercel serves `index.html` and the `/api/rates` serverless function.

For a CLI deployment, run `npx vercel --prod` in this directory (requires Vercel authentication).

## Behavior

- Type in any of the 3 fields and the other 2 update instantly.
- Rate lookup occurs when opened, when connectivity returns, when the app becomes visible, every 15 minutes while active, or on Refresh. Manual refresh bypasses the scheduled cache URL and shows checking plus completion/failure feedback.
- Main provider: https://www.exchangerate-api.com/docs/free (open, no-key endpoint).
- Fallback: https://frankfurter.dev/ (reference rate updates).
- Vercel edge cache is configured for 15 minutes. The provider's publication timestamp and the last successful fetch are shown separately; a publication timestamp older than 24 hours triggers a warning.
- The last complete, validated rate set is saved in local storage and is never replaced by an invalid or incomplete response.
- Monetary conversion is calculated entirely in-browser; only currency exchange rates are fetched.

## Offline operation

- `service-worker.js` precaches the complete app shell, manifest, official lion logo and every icon.
- After one successful online initialization, the app can launch and convert entirely offline using the most recently saved rates.
- The rate API is deliberately not cached by the service worker. Offline operation uses the validated local record so the interface can accurately distinguish online updates from saved data.
- “Ready for offline use” appears only after the service worker confirms every required app-shell resource is cached and a valid rate record exists.
- Statuses distinguish updated data, offline saved data and data more than 24 hours old.
- iOS background refresh is not used; updates occur only while the app is open or when it resumes/connectivity returns.

To initialize on iPhone, open the site online once and wait for “Ready for offline use” before using Safari’s Add to Home Screen action.

## Verification

Run `node tests/offline-state-tests.js` for dependency-free regression coverage of online initialization, offline saved-rate use, the 24-hour stale warning, invalid-response rejection and first-launch handling.

Browser verification also covers a fresh online initialization followed by a complete origin shutdown, app relaunch from the service-worker cache and conversion from persisted rates.

### Physical iPhone check

The final device-only check is to open the production URL in iPhone Safari, wait for “Ready for offline use,” add it to the Home Screen, enable Airplane Mode, fully close the installed PWA and relaunch it. The app should open with the lion branding and convert all three currencies from the saved rates. This exact Home Screen lifecycle cannot be emulated completely without a physical iPhone.

## Branding and PWA metadata

- Canonical logo: `assets/czech-lion-logo.png`
- iPhone Home Screen icon: `icons/apple-touch-icon.png` (180×180)
- PWA icons: `icons/icon-192x192.png` and `icons/icon-512x512.png`
- Browser favicons: `icons/favicon-32x32.png` and `icons/favicon-48x48.png`
- Web app manifest: `manifest.webmanifest`

Exchange rates are indicative and card/bank rates may differ.
