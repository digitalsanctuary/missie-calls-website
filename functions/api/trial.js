const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const reply = (status, message) => new Response(JSON.stringify({ ok: status < 400, message }), { status, headers: JSON_HEADERS });
const clean = (value, limit = 160) => typeof value === 'string' ? value.trim().slice(0, limit) : '';

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).hostname !== new URL(request.url).hostname) return reply(403, 'Please use the form on missiecalls.au.');
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 10000) return reply(413, 'Request too large.');
  if (!env.AIRTABLE_TOKEN || !env.TURNSTILE_SECRET) return reply(503, 'Trial registration is being connected. Please try again later.');
  let input;
  try { input = await request.json(); } catch { return reply(400, 'Please check your details and try again.'); }
  if (!input || typeof input !== 'object') return reply(400, 'Invalid form.');
  if (clean(input.company_website)) return reply(200, 'Thanks. Your request has been received.');
  const name = clean(input.name, 100), business = clean(input.business, 120);
  const mobile = clean(input.mobile, 40), email = clean(input.email, 200).toLowerCase();
  const trade = clean(input.trade, 80);
  if (!name || !business || !/^\\+?[0-9 ()-]{8,20}$/.test(mobile) || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !trade || trade.length > 80) {
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
  return reply(201, 'Thanks. We have your details and will be in touch to set up Missie. Your free trial starts only after activation.');
}

export async function onRequestGet() { return reply(405, 'Method not allowed.'); }
