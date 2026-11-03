import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from './suggest';

const post = (body: unknown, origin = 'https://photonova.pages.dev', ip = '1.2.3.4') =>
  new Request('https://photonova.pages.dev/api/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
const good = { title: '[Bug] Eye diagram is blank', body: '**Type:** Something is broken\nThe eye diagram goes blank after switching to PAM-4.', labels: 'bug', website: '' };

afterEach(() => vi.restoreAllMocks());

describe('POST /api/suggest', () => {
  it('answers 503 when no token is configured', async () => {
    const r = await onRequestPost({ request: post(good), env: {} });
    expect(r.status).toBe(503);
  });

  it('files a GitHub issue with the token and allowed labels only', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ html_url: 'https://github.com/x/y/issues/7', number: 7 }), { status: 201 }));
    const r = await onRequestPost({ request: post({ ...good, labels: 'bug,admin' }, undefined, '9.9.9.1'), env: { GITHUB_TOKEN: 't0k' } });
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ ok: true, number: 7 });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/nbanihasan/photonova/issues');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t0k');
    expect(JSON.parse(init.body as string).labels).toEqual(['bug']);
  });

  it('silently drops honeypot submissions without calling GitHub', async () => {
    const f = vi.spyOn(globalThis, 'fetch');
    const r = await onRequestPost({ request: post({ ...good, website: 'http://spam' }, undefined, '9.9.9.2'), env: { GITHUB_TOKEN: 't' } });
    expect(r.status).toBe(200);
    expect(f).not.toHaveBeenCalled();
  });

  it('rejects empty, oversized and foreign-origin submissions', async () => {
    expect((await onRequestPost({ request: post({ ...good, title: 'hi' }, undefined, '9.9.9.3'), env: { GITHUB_TOKEN: 't' } })).status).toBe(400);
    expect((await onRequestPost({ request: post({ ...good, body: 'x'.repeat(9000) }, undefined, '9.9.9.4'), env: { GITHUB_TOKEN: 't' } })).status).toBe(400);
    expect((await onRequestPost({ request: post(good, 'https://evil.example', '9.9.9.5'), env: { GITHUB_TOKEN: 't' } })).status).toBe(403);
  });

  it('rate-limits a burst from one address', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ html_url: 'u', number: 1 }), { status: 201 }));
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await onRequestPost({ request: post(good, undefined, '7.7.7.7'), env: { GITHUB_TOKEN: 't' } })).status);
    expect(codes.slice(0, 5).every((c) => c === 201)).toBe(true);
    expect(codes[5]).toBe(429);
  });
});
