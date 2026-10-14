import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { User } from '@supabase/supabase-js';
import { verifiedIdentity } from '../lib/identity';
import { readJson, assertSameOrigin, errorResponse } from '../lib/http';
import { AppError } from '../lib/domain';

const user = { id: 'user-1', email: 'Owner@studio.test', email_confirmed_at: '2026-10-14', is_anonymous: false, user_metadata: { full_name: 'Test Owner', role: 'owner' } } as unknown as User;

test('only verified non-anonymous users become identities; editable metadata cannot confer roles', () => {
  assert.equal(verifiedIdentity(null), null);
  assert.equal(verifiedIdentity({ ...user, is_anonymous: true }), null);
  assert.equal(verifiedIdentity({ ...user, email_confirmed_at: undefined }), null);
  assert.equal(verifiedIdentity({ ...user, email: undefined }), null);
  assert.deepEqual(verifiedIdentity(user), { userId: 'user-1', email: 'owner@studio.test', displayName: 'Test Owner' });
  assert.ok(!('role' in verifiedIdentity(user)!));
});

function request(body: string, origin = 'https://studio.test', contentType = 'application/json') {
  return new Request('https://studio.test/api/studio', { method: 'POST', headers: { origin, 'content-type': contentType }, body });
}

test('write requests reject foreign/missing origins, malformed or non-object JSON, and wrong content types', async () => {
  assert.throws(() => assertSameOrigin(request('{}', 'https://evil.test')), error => error instanceof AppError && error.status === 403);
  assert.throws(() => assertSameOrigin(new Request('https://studio.test/api/studio')), error => error instanceof AppError && error.status === 403);
  await assert.rejects(readJson(request('{}', 'https://studio.test', 'text/plain')), error => error instanceof AppError && error.status === 415);
  for (const input of ['{', '[]', 'null', '3']) await assert.rejects(readJson(request(input)), /JSON/);
  assert.deepEqual(await readJson(request('{"action":"save"}')), { action: 'save' });
});

test('request limit counts UTF-8 bytes and caps streamed payloads without content-length', async () => {
  await assert.rejects(readJson(request(JSON.stringify({ text: 'ư'.repeat(110000) }))), error => error instanceof AppError && error.status === 413);
  const response = errorResponse(new Error('secret-password-data'));
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.ok(!(await response.text()).includes('secret-password-data'));
});
