import { getIdentity } from '../../../lib/auth';
import { getState, mutate } from '../../../lib/service';
import { createWorkspaceStore } from '../../../lib/supabase/store';
import { errorResponse, json, readJson } from '../../../lib/http';

export const dynamic = 'force-dynamic';

async function processRequest(request: Request, write = false) {
  try {
    const identity = await getIdentity();
    if (!identity) return json({ error: 'Vui lòng đăng nhập Studio Hub.' }, 401);
    const store = createWorkspaceStore();
    const ownerEmail = process.env.STUDIO_OWNER_EMAIL || '';
    return json(write
      ? await mutate(store, identity, await readJson(request), ownerEmail)
      : await getState(store, identity, ownerEmail));
  } catch (error) { return errorResponse(error); }
}

export async function GET(request: Request) { return processRequest(request); }
export async function POST(request: Request) { return processRequest(request, true); }
