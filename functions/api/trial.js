const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const reply = (status, message) => new Response(JSON.stringify({ ok: status < 400, message }), { status, headers: JSON_HEADERS });
const clean = (value, limit = 160) => typeof value === 'string' ? value.trim().slice(0, limit) : '';


// Email delivery is intentionally separate from registration. An email failure must
// never cause the browser to retry a registration that Airtable already saved.
async function sendEmail(apiKey, from, to, subject, body, dedupeKey) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Idempotency-Key': dedupeKey
    },
    body: JSON.stringify({ from, to: [to], subject, text: body })
  });
  if (!response.ok) throw new Error('Resend status ' + response.status);
}

async function notifyRegistration(env, details, recordId) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.TRIAL_NOTIFICATION_EMAIL) {
    console.warn('Trial registration saved but emails not configured (RESEND_API_KEY, RESEND_FROM_EMAIL, TRIAL_NOTIFICATION_EMAIL).');
    return;
  }
  const firstName = details.name.split(/\s+/)[0];
  const recordLink = 'https://airtable.com/appukZTSoNYXsVAqi/tblBqj9RbHVOAWW7E/' + encodeURIComponent(recordId);
  const customerText = [
    'Hi ' + firstName + ',',
    '',
    'Thanks for requesting a 14-day trial of Missie Calls for ' + details.business + '.',
    '',
    "We've received your details. We'll be in touch to help set up Missie for your business, including missed-call forwarding and how she should respond to your customers.",
    '',
    "Your free trial hasn't started yet. The 14 days begin only after Missie is activated and working.",
    '',
    'Missie Calls',
    'https://missiecalls.au'
  ].join('\n');
  const ownerText = [
    'New Missie Calls trial request',
    '',
    'Name: ' + details.name,
    'Business: ' + details.business,
    'Mobile: ' + details.mobile,
    'Email: ' + details.email,
    'Business type: ' + details.trade,
    '',
    'Status: New enquiry (not activated)',
    'Airtable record: ' + recordLink,
    '',
    'Next step: Contact applicant and arrange setup. Trial clock has not started.'
  ].join('\n');

  const outcomes = await Promise.allSettled([
    sendEmail(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL, details.email,
      "We've received your Missie Calls trial request", customerText, 'missie-trial-customer-' + recordId),
    sendEmail(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL, env.TRIAL_NOTIFICATION_EMAIL,
      'New Missie Calls trial request: ' + details.business, ownerText, 'missie-trial-owner-' + recordId)
  ]);
  outcomes.forEach((outcome, i) => {
    if (outcome.status === 'rejected') console.error(
      i === 0 ? 'Trial confirmation email failed' : 'Trial owner notification failed',
      recordId, String(outcome.reason)
    );
  });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).hostname !== new URL(request.url).hostname) return reply(403, 'Please use the form on missiecalls.au.');
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 10000) return reply(413, 'Request too large.');
  if (!env.AIRTABLE_TOKEN || !env.TURNSTILE_SECRET) return reply(503, 'Trial registration is being connected. Please try again later.');
  let input;
  try { input = await request.json(); } catch { return reply(400, 'Please check your details and try again.'); }
  if (!input || typeof input !== 'object') return reply(400, 'Invalid form.');
  const name = clean(input.name, 100), business = clean(input.business, 120);
  const mobile = clean(input.mobile, 40), email = clean(input.email, 200).toLowerCase();
  const trade = clean(input.trade, 80);
  if (!name || !business || !/^\+?[0-9 ()-]{8,20}$/.test(mobile) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !trade || trade.length > 80) {
    return reply(400, 'Please complete all fields with valid contact details.');
  }
  const token = clean(input.turnstileToken, 2048);
  if (!token) return reply(400, 'Please complete the security check.');
  let verification;
  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: request.headers.get('CF-Connecting-IP') || '' })
    });
    verification = await result.json();
  } catch { return reply(503, 'Could not verify the security check. Try again.'); }
  if (!verification.success || (verification.hostname && verification.hostname !== new URL(request.url).hostname)) return reply(403, 'Security check failed. Please try again.');
  const fields = {
    'Business Name': business,
    'Contact Name': name,
    'Mobile': mobile,
    'Email': email,
    'Trade': trade,
    'Status': 'New enquiry',
    'Requested At': new Date().toISOString(),
    'Source': 'Website free trial'
  };
  let upstream;
  try {
    upstream = await fetch('https://api.airtable.com/v0/appukZTSoNYXsVAqi/tblBqj9RbHVOAWW7E', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.AIRTABLE_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
  } catch { return reply(503, 'Unable to submit right now. Please try again.'); }
  if (!upstream.ok) {
    console.error('Airtable trial request failed', upstream.status);
    return reply(503, 'Unable to submit right now. Please try again.');
  }
  try {
    const created = await upstream.json();
    if (created && typeof created.id === 'string' && /^rec[A-Za-z0-9]{14}$/.test(created.id)) {
      await notifyRegistration(env, { name, business, mobile, email, trade }, created.id);
    } else {
      console.error('Airtable accepted trial request but record ID was missing');
    }
  } catch (error) {
    console.error('Trial saved but notification handling failed', String(error));
  }
  return reply(201, 'Thanks. We have your details and will be in touch to set up Missie. Your free trial starts only after activation.');
}

export async function onRequestGet() { return reply(405, 'Method not allowed.'); }
