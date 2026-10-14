import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database, postgresStore } from './helpers';
import { demoWorkspace } from '../lib/demo';

test('migration denies direct reads/writes for anon and authenticated even if table grants are accidentally added', async () => {
  const db = await database();
  try {
    await postgresStore(db).initialize(demoWorkspace({ userId: 'owner', email: 'owner@studio.test', displayName: 'Owner' }));
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from public.studio_hub_workspaces'), /permission denied/);
      await assert.rejects(db.query("update public.studio_hub_workspaces set revision=2 where id='main'"), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('grant select, insert, update on public.studio_hub_workspaces to anon, authenticated');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      assert.equal((await db.query('select * from public.studio_hub_workspaces')).rows.length, 0);
      assert.equal((await db.query("update public.studio_hub_workspaces set revision=2 where id='main' returning id")).rows.length, 0);
      await assert.rejects(db.query("insert into public.studio_hub_workspaces(id,payload) values('main','{}')"), /row-level security/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.equal((await db.query('select * from public.studio_hub_workspaces')).rows.length, 1);
  } finally { await db.close(); }
});

test('snapshot constraints reject invalid identifiers, JSON types and negative revisions', async () => {
  const db = await database();
  try {
    await assert.rejects(db.query("insert into public.studio_hub_workspaces(id,payload) values('other','{}')"), /check constraint/);
    await assert.rejects(db.query("insert into public.studio_hub_workspaces(id,payload) values('main','[]')"), /check constraint/);
    await assert.rejects(db.query("insert into public.studio_hub_workspaces(id,payload,revision) values('main','{}',-1)"), /check constraint/);
  } finally { await db.close(); }
});
