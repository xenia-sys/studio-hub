import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicConfig } from '../config';
import { AppError, type Workspace } from '../domain';
import type { WorkspaceStore } from '../store';

const TABLE = 'studio_hub_workspaces';

/** Never import this module from a Client Component. No user session is shared. */
export function createWorkspaceStore(): WorkspaceStore {
  const config = publicConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key) throw new AppError('Studio Hub chưa được cấu hình dữ liệu.', 503);
  const client = createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return supabaseStore(client);
}

export function supabaseStore(client: SupabaseClient): WorkspaceStore {
  return {
    async read() {
      const { data, error } = await client.from(TABLE).select('payload,revision').eq('id', 'main').maybeSingle();
      if (error) throw new AppError('Không thể đọc dữ liệu studio. Kiểm tra cấu hình cơ sở dữ liệu.', 503);
      return data ? { state: data.payload as Workspace, revision: Number(data.revision) } : null;
    },
    async initialize(state) {
      const { error } = await client.from(TABLE).upsert(
        { id: 'main', payload: state, revision: 0 },
        { onConflict: 'id', ignoreDuplicates: true },
      );
      if (error) throw new AppError('Không thể khởi tạo dữ liệu studio.', 503);
    },
    async compareAndSwap(state, revision) {
      const { data, error } = await client.from(TABLE)
        .update({ payload: state, revision: revision + 1, updated_at: new Date().toISOString() })
        .eq('id', 'main').eq('revision', revision).select('revision').maybeSingle();
      if (error) throw new AppError('Không thể lưu dữ liệu studio.', 503);
      return !!data;
    },
  };
}
