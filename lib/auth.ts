import 'server-only';
import { redirect } from 'next/navigation';
import { createAuthClient } from './supabase/server';
import type { Identity } from './domain';
import { verifiedIdentity } from './identity';

export async function getIdentity(): Promise<Identity | null> {
  const client = await createAuthClient();
  // Authorize using a user verified by Supabase Auth, never request headers or getSession().
  const { data: { user }, error } = await client.auth.getUser();
  return error ? null : verifiedIdentity(user);
}

export async function requireIdentity() {
  const identity = await getIdentity();
  if (!identity) redirect('/login');
  return identity;
}
