import { createAuthClient } from '../../../../lib/supabase/server';
import { assertSameOrigin, errorResponse, json } from '../../../../lib/http';
import { AppError } from '../../../../lib/domain';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const client = await createAuthClient();
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw new AppError('Chưa thể đăng xuất.', 503);
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
