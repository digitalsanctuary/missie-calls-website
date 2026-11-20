# Missie Calls trial form configuration

Trial registrations are recorded in Airtable **Missie Calls – Client Onboarding → Trial Requests**.

## Required Cloudflare Pages variables

In **Workers & Pages → missie-calls-website → Settings → Variables and Secrets** add to **Production**:

- `PUBLIC_TURNSTILE_SITE_KEY` (plain text): Cloudflare Turnstile site key for `missiecalls.au`. **Build-time** variable (rebuild/redeploy after setting).
- `TURNSTILE_SECRET` (secret): matching Turnstile secret key. **Runtime** binding.
- `AIRTABLE_TOKEN` (secret): Airtable personal access token with `data.records:write` to the Missie Calls onboarding base only. **Runtime** binding.

Turnstile site should include host `missiecalls.au`. Protect any alternative hosts that may accept registrations.

## Behaviour

- All 'Start free trial' buttons on the homepage link to `#trial-signup`.
- Form fields: name, business name, mobile, email, trade.
- Server-side validation and Cloudflare Turnstile verification; bot honeypot; same-origin guard.
- Fail closed if credentials are not configured, with an error and no misleading success.
- A successful submission creates a **Trial Requests** record with `Status = New enquiry` and `Requested At`.
- It does **not** create a client, start the 14-day clock, send payment requests, or activate an AWS/Twilio account.
- Later onboarding should explicitly set `Activated At` only when SMS/forwarding has been tested; then derive `Trial Ends At` 14 days later.

## Acceptance test

1. Open the protected website with Cloudflare Access.
2. Confirm the signup form appears and its Turnstile loads.
3. Submit a clearly labeled test registration.
4. Verify the record appears in Airtable Trial Requests as New enquiry with **blank** Activated At and Trial Ends At.
5. Try invalid details and a submission without Turnstile verification; confirm they do not create records.
6. Verify the website is mobile friendly and no Airtable token appears in browser network payloads or scripts.

**Important:** A new Airtable record does not automatically email anyone or start onboarding until a notification/workflow is connected.
