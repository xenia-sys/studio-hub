import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicConfig } from '../config';
import { AppError } from '../domain';

export async function createAuthClient() {
  const config = publicConfig();
  if (!config) throw new AppError('Studio Hub chưa được cấu hình đăng nhập.', 503);
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; proxy.ts performs refresh.
        }
      },
    },
  });
}
