import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import type { Workspace } from '../lib/domain';
import type { WorkspaceStore } from '../lib/store';

export async function database() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261014091938_studio_hub_workspace.sql', import.meta.url), 'utf8'));
  return db;
}

export function postgresStore(db: PGlite): WorkspaceStore {
  return {
    async read() {
      const { rows } = await db.query<{ payload: Workspace; revision: number }>('select payload, revision from public.studio_hub_workspaces where id=$1', ['main']);
      return rows[0] ? { state: rows[0].payload, revision: rows[0].revision } : null;
    },
    async initialize(state) {
      await db.query('insert into public.studio_hub_workspaces(id,payload,revision) values($1,$2,0) on conflict(id) do nothing', ['main', JSON.stringify(state)]);
    },
    async compareAndSwap(state, revision) {
      const result = await db.query('update public.studio_hub_workspaces set payload=$1, revision=revision+1 where id=$2 and revision=$3 returning revision', [JSON.stringify(state), 'main', revision]);
      return result.rows.length === 1;
    },
  };
}
