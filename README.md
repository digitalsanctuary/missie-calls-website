# Missie Calls website

Astro + Cloudflare Pages website for missiecalls.au.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

## Build and deployment

```bash
npm run build
```

Connect a GitHub repository to Cloudflare Pages. Framework preset: **Astro**. Build command: **npm run build**. Output directory: **dist**. Node version: **22**.

## Before going live

1. Set `PUBLIC_DEMO_NUMBER` to the working Twilio demo phone number (E.164, e.g. `+61...`). This enables the real call button. The underlying AWS/Twilio demo conversation must be separately configured and tested, including session caps, throttling and abuse protection.
2. Set `PUBLIC_TRIAL_URL` to a secure, live trial signup page. This enables the trial CTAs. Do not collect personal details on an unconfigured frontend form.
3. Add genuine support/business contact information and approved legal documents. Privacy and terms are intentionally unlinked until published; do not invent legal terms.
4. Test mobile and accessibility, live calls, summaries, trial activation, billing consent and reporting end-to-end before launching.

The example SMS conversation on the website is **illustrative**; it is not connected to AWS and is labelled as such. No payment or trial is activated by this repository alone.
