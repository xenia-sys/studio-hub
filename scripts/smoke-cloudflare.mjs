import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

// Exercise the compiled Worker with dummy configuration. No production keys,
// users or database writes are needed for these authentication boundary checks.
const portProbe = createServer();
portProbe.listen(0, '127.0.0.1');
await once(portProbe, 'listening');
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'dev',
  '--config', 'dist/server/wrangler.json', '--local',
  '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', '0',
  '--var', 'NEXT_PUBLIC_SUPABASE_URL:https://cloudflare-smoke.invalid',
  '--var', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:sb_publishable_smoke',
  '--var', 'SUPABASE_SECRET_KEY:server-only-smoke-sentinel',
  '--var', 'STUDIO_OWNER_EMAIL:smoke-owner@example.invalid',
  '--var', `APP_ORIGIN:${origin}`,
], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' } });
let logs = '';
child.stdout.on('data', chunk => { logs += chunk; });
child.stderr.on('data', chunk => { logs += chunk; });
const request = (path, init = {}) => fetch(`${origin}${path}`, { redirect: 'manual', ...init });
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error(`Worker exited before startup (${child.exitCode}).\n${logs}`);
    try { await request('/login'); ready = true; break; } catch { await delay(250); }
  }
  assert.ok(ready, `Worker did not start.\n${logs}`);

  const login = await request('/login');
  assert.equal(login.status, 200);
  assert.match(login.headers.get('cache-control') || '', /no-store/);
  assert.equal(login.headers.get('x-frame-options'), 'DENY');
  const html = await login.text();
  assert.match(html, /type="password"/);
  assert.ok(!html.includes('server-only-smoke-sentinel'));
  assert.ok(!html.includes('smoke-owner@example.invalid'));

  const root = await request('/');
  assert.ok([302, 303, 307, 308].includes(root.status));
  assert.equal(new URL(root.headers.get('location'), origin).pathname, '/login');

  const api = await request('/api/studio');
  assert.equal(api.status, 401);
  assert.match(api.headers.get('cache-control') || '', /no-store/);
  assert.ok(!('state' in await api.json()));

  for (const path of ['/api/studio', '/api/auth/login', '/api/auth/logout']) {
    const response = await request(path, {
      method: 'POST',
      headers: { origin: 'https://foreign.example.invalid', 'content-type': 'application/json' },
      body: '{}',
    });
    // The data API checks identity before reading the body; login/logout check
    // Origin first. Both must reject this unauthenticated, foreign-origin call.
    assert.equal(response.status, path === '/api/studio' ? 401 : 403,
      `Cross-origin request was not rejected at ${path}`);
  }

  const stylesheet = html.match(/href="([^\"]+\.css)"/);
  assert.ok(stylesheet, 'Login page is missing its stylesheet');
  const css = await request(stylesheet[1]);
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type') || '', /text\/css/);
  console.log('Cloudflare Worker smoke checks passed: login rendering, assets, private headers, redirects, unauthenticated API, CSRF and secret redaction.');
} catch (error) {
  console.error(logs.slice(-8000));
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), delay(3000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
