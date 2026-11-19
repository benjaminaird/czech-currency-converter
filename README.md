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
- Rate lookup occurs when opened, when tab becomes visible, every 15 minutes, or on Refresh.
- Main provider: https://www.exchangerate-api.com/docs/free (open, no-key endpoint).
- Fallback: https://frankfurter.dev/ (reference rate updates).
- Vercel edge cache is configured for 15 minutes. The provider's rate timestamp and the last successful fetch are shown separately; a rate older than 4 days triggers a warning.
- The last successful rates are cached in the browser so conversion remains available during a temporary network failure.
- Monetary conversion is calculated entirely in-browser; only currency exchange rates are fetched.

## Branding and PWA metadata

- Canonical logo: `assets/czech-lion-logo.png`
- iPhone Home Screen icon: `icons/apple-touch-icon.png` (180×180)
- PWA icons: `icons/icon-192x192.png` and `icons/icon-512x512.png`
- Browser favicons: `icons/favicon-32x32.png` and `icons/favicon-48x48.png`
- Web app manifest: `manifest.webmanifest`

Exchange rates are indicative and card/bank rates may differ.
