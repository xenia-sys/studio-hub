import { createAuthClient } from '../../../../lib/supabase/server';
import { errorResponse, json, readJson } from '../../../../lib/http';
import { AppError } from '../../../../lib/domain';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (email.length > 200 || password.length > 1024 || !email || !password) throw new AppError('Nhập email và mật khẩu hợp lệ.');
    const client = await createAuthClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user?.email_confirmed_at || data.user.is_anonymous) return json({ error: 'Email hoặc mật khẩu không hợp lệ, hoặc tài khoản chưa được xác nhận.' }, 401);
    // Data access is checked separately for every API request against workspace membership.
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
