import type { User } from '@supabase/supabase-js';
import type { Identity } from './domain';

/** Input must come from Supabase auth.getUser(), never a client-provided object. */
export function verifiedIdentity(user: User | null): Identity | null {
  if (!user?.id || !user.email || !user.email_confirmed_at || user.is_anonymous) return null;
  return {
    userId: user.id,
    email: user.email.toLowerCase(),
    displayName: String(user.user_metadata?.full_name || user.email.split('@')[0]).slice(0, 160),
  };
}
