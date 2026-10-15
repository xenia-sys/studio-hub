export function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function applicationConfigured() {
  return !!(publicConfig() && process.env.SUPABASE_SECRET_KEY && process.env.STUDIO_OWNER_EMAIL);
}
