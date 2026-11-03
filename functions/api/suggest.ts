/**
 * Cloudflare Pages Function: POST /api/suggest
 *
 * Lets visitors without a GitHub account send a suggestion. The website's form posts
 * { title, body, labels, website } here; this function files it as a GitHub issue using a token
 * that only the maintainer holds (Cloudflare secret GITHUB_TOKEN, a fine-grained token with
 * "Issues: read and write" on this one repository). The token never reaches the browser.
 *
 * Abuse guards: a honeypot field, length limits, a same-site origin check, and a light per-IP
 * rate limit (per edge instance). If GITHUB_TOKEN is not set, it answers 503 and the form falls
 * back to the GitHub / copy-text options.
 */

interface Env {
  GITHUB_TOKEN?: string;
  /** optional override, e.g. "someone/fork" */
  GITHUB_REPO?: string;
}

const REPO_DEFAULT = 'nbanihasan/photonova';
const ALLOWED_ORIGINS = ['https://photonova.pages.dev', 'https://nbanihasan.github.io'];
const ALLOWED_LABELS = new Set(['bug', 'content', 'enhancement']);
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function cors(origin: string | null): Record<string, string> {
  const ok = origin && (ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.photonova\.pages\.dev$/.test(origin));
  return ok
    ? { 'Access-Control-Allow-Origin': origin!, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {};
}

function json(data: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
}

export const onRequestOptions = ({ request }: { request: Request }) => new Response(null, { status: 204, headers: cors(request.headers.get('Origin')) });

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const origin = request.headers.get('Origin');
  const sameSite = !origin || new URL(request.url).origin === origin || Object.keys(cors(origin)).length > 0;
  if (!sameSite) return json({ error: 'Not allowed from this site.' }, 403, origin);
  if (!env.GITHUB_TOKEN) return json({ error: 'Sending without an account is not set up yet.' }, 503, origin);

  let data: { title?: unknown; body?: unknown; labels?: unknown; website?: unknown };
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400, origin);
  }
  // honeypot: real people never fill the hidden "website" field; pretend success for bots
  if (typeof data.website === 'string' && data.website.trim()) return json({ ok: true }, 200, origin);

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const body = typeof data.body === 'string' ? data.body.trim() : '';
  if (title.length < 8 || title.length > 160 || body.length < 20 || body.length > 8000) return json({ error: 'Please add a short summary and some detail.' }, 400, origin);
  if ((body.match(/https?:\/\//g) ?? []).length > 6) return json({ error: 'Too many links.' }, 400, origin);

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return json({ error: 'Too many suggestions in a short time. Please try again later.' }, 429, origin);
  recent.push(now);
  hits.set(ip, recent);

  const labels = (Array.isArray(data.labels) ? data.labels : String(data.labels ?? '').split(','))
    .map((l) => String(l).trim())
    .filter((l) => ALLOWED_LABELS.has(l));

  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO || REPO_DEFAULT}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'photonova-suggest',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      body: `${body}\n\n_Sent without a GitHub account through the website form._`,
      labels,
    }),
  });
  if (!res.ok) {
    // labels the repo does not have make GitHub reject the issue: retry once without them
    if (res.status === 422 && labels.length) {
      const retry = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO || REPO_DEFAULT}/issues`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'photonova-suggest', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body: `${body}\n\n_Sent without a GitHub account through the website form._` }),
      });
      if (retry.ok) {
        const j = (await retry.json()) as { html_url: string; number: number };
        return json({ ok: true, url: j.html_url, number: j.number }, 201, origin);
      }
    }
    return json({ error: 'GitHub did not accept the suggestion. Please try the GitHub button or copy the text.' }, 502, origin);
  }
  const issue = (await res.json()) as { html_url: string; number: number };
  return json({ ok: true, url: issue.html_url, number: issue.number }, 201, origin);
}
