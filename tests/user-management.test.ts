import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manageUsers } from '../supabase/functions/manage-users/handler.ts';
const own = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
function setup({ authenticated = true, editor = true, roleError = false, revokeError = false, inviteError = false, deleteError = false } = {}) {
  const calls: string[] = [];
  const deps = {
    caller: (token: string) => {
      assert.equal(token, 'valid');
      return {
        auth: { getUser: async () => ({ data: { user: authenticated ? { id: own } : null }, error: !authenticated }) },
        rpc: async (name: string, args?: Record<string, unknown>) => {
          calls.push(name);
          if (name === 'kk_is_editor') return { data: editor, error: roleError };
          if (name === 'kk_list_members') return { data: [{ user_id: other, email: 'existing@example.test', is_admin: true }], error: null };
          assert.deepEqual(args, { member_id: other, allowed: false });
          return { data: null, error: revokeError };
        },
      };
    },
    administrator: () => {
      calls.push('privileged');
      return { auth: { admin: {
        inviteUserByEmail: async (email: string, options: { redirectTo: string }) => {
          calls.push('invite'); assert.equal(email, 'new@example.test');
          assert.equal(options.redirectTo, 'https://www.loci-amsterdam.nl/kunstkiezer/account');
          return { data: { user: inviteError ? null : { id: other } }, error: inviteError ? { message: 'SMTP' } : null };
        },
        deleteUser: async (id: string) => { calls.push('delete'); assert.equal(id, other); return { error: deleteError ? { message: 'database' } : null }; },
      } } };
    },
  };
  const request = (body: unknown, origin = 'https://www.loci-amsterdam.nl', token = 'valid') => new Request('https://test/manage-users', { method: 'POST', headers: { origin, authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return { calls, deps, request };
}
test('Gebruikersbeheer weigert ongeldige sessies, bezoekers en mislukte rechtencontrole zonder beheerssleutel', async () => {
  for (const options of [{ authenticated: false }, { editor: false }, { roleError: true }]) {
    const s = setup(options);
    const response = await manageUsers(s.request({ action: 'invite', email: 'new@example.test' }), s.deps);
    assert.equal(response.status, options.authenticated === false ? 401 : 403);
    assert.ok(!s.calls.includes('privileged'));
  }
});
test('Vreemde origins en ontbrekende tokens bereiken de database niet', async () => {
  const s = setup();
  assert.equal((await manageUsers(s.request({}, 'https://bad.test'), s.deps)).status, 403);
  assert.equal((await manageUsers(s.request({}, undefined, ''), s.deps)).status, 401);
  assert.deepEqual(s.calls, []);
});
test('Beheerder kan uitnodigen; e-mail normaliseert en extra meegegeven rechten worden genegeerd', async () => {
  const s = setup();
  const response = await manageUsers(s.request({ action: 'invite', email: ' New@Example.Test ', is_admin: true }), s.deps);
  assert.equal(response.status, 200); assert.equal((await response.json()).invited, true);
  assert.deepEqual(s.calls, ['kk_is_editor', 'kk_list_members', 'privileged', 'invite']);
});
test('Bestaande accounts, ongeldige invoer en onbekende acties starten geen uitnodiging', async () => {
  for (const body of [{ action: 'invite', email: 'existing@example.test' }, { action: 'invite', email: 'broken' }, { action: 'invite', email: null }, { action: 'bogus' }, null]) {
    const s = setup();
    assert.ok((await manageUsers(s.request(body), s.deps)).status >= 400);
    assert.ok(!s.calls.includes('privileged'));
  }
});
test('Mislukte e-mailverzending geeft geen succesvolle toevoeging', async () => {
  const s = setup({ inviteError: true });
  const response = await manageUsers(s.request({ action: 'invite', email: 'new@example.test' }), s.deps);
  assert.equal(response.status, 409); assert.match((await response.json()).error, /e-mailverzending/);
});
test('Verwijderen trekt eerst rechten in en verwijdert daarna exact het gekozen account', async () => {
  const s = setup();
  const response = await manageUsers(s.request({ action: 'delete', user_id: other }), s.deps);
  assert.equal(response.status, 200);
  assert.deepEqual(s.calls, ['kk_is_editor', 'kk_list_members', 'kk_set_admin', 'privileged', 'delete']);
});
test('Eigen account, ongeldige id en ontbrekende gebruiker worden niet verwijderd', async () => {
  for (const id of [own, 'invalid', '00000000-0000-4000-8000-000000000099']) {
    const s = setup();
    assert.ok((await manageUsers(s.request({ action: 'delete', user_id: id }), s.deps)).status >= 400);
    assert.ok(!s.calls.includes('privileged'));
  }
});
test('Databaseblokkade voor rechten of laatste beheerder voorkomt verwijderen', async () => {
  const s = setup({ revokeError: true });
  assert.equal((await manageUsers(s.request({ action: 'delete', user_id: other }), s.deps)).status, 409);
  assert.ok(!s.calls.includes('privileged'));
});
test('Gedeeltelijke mislukking meldt eerlijk dat rechten al ingetrokken zijn', async () => {
  const s = setup({ deleteError: true });
  const response = await manageUsers(s.request({ action: 'delete', user_id: other }), s.deps);
  assert.equal(response.status, 409); assert.match((await response.json()).error, /rechten zijn ingetrokken/);
});
