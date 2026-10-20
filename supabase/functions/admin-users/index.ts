// دالة Edge لإدارة المستخدمين بأمان — تعمل بمفتاح service_role على الخادم فقط.
// Edge Function: secure user management. The service_role key never reaches the browser.
//
// النشر / Deploy:
//   supabase functions deploy admin-users
//   supabase secrets set AUTH_EMAIL_DOMAIN=daftar-auth.app ALLOWED_ORIGIN=https://your-app.vercel.app
// (SUPABASE_URL و SUPABASE_ANON_KEY و SUPABASE_SERVICE_ROLE_KEY تُحقن تلقائيًا)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DOMAIN = Deno.env.get('AUTH_EMAIL_DOMAIN') ?? 'daftar-auth.app';
const ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const ROLES = ['admin', 'collector', 'viewer'];

const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// يجب أن يطابق usernameToEmail() في app.js حرفيًا
function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase();
  if (/^[a-z0-9._-]{1,48}$/.test(u)) return `${u}@${DOMAIN}`;
  const hex = [...new TextEncoder().encode(u)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `x-${hex}@${DOMAIN}`;
}
function validUsername(u: unknown): u is string {
  if (typeof u !== 'string') return false;
  const s = u.trim();
  return s.length >= 3 && new TextEncoder().encode(s).length <= 30;
}
function validPassword(p: unknown): p is string {
  return typeof p === 'string' && p.length >= 8 && p.length <= 128;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const asCaller = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: who, error: whoErr } = await asCaller.auth.getUser(token);
  if (whoErr || !who?.user) return json({ error: 'Unauthorized' }, 401);
  const callerId = who.user.id;

  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: me } = await admin.from('profiles').select('id, role').eq('id', callerId).maybeSingle();
  if (!me) return json({ error: 'Profile not found' }, 403);
  const isAdmin = me.role === 'admin';

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const action = String(body.action ?? '');

  async function adminCount() {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
    return count ?? 0;
  }
  async function usernameTaken(username: string, exceptId?: string) {
    const { data } = await admin.from('profiles').select('id').ilike('username', username.trim());
    return (data ?? []).some((r) => r.id !== exceptId);
  }

  try {
    if (action === 'create') {
      if (!isAdmin) return json({ error: 'Admins only' }, 403);
      const { username, password, role, permissions } = body;
      if (!validUsername(username)) return json({ error: 'Invalid username' }, 400);
      if (!validPassword(password)) return json({ error: 'Password must be at least 8 characters' }, 400);
      if (!ROLES.includes(role)) return json({ error: 'Invalid role' }, 400);
      if (await usernameTaken(username)) return json({ error: 'Username already taken' }, 409);
      const { data: created, error } = await admin.auth.admin.createUser({
        email: usernameToEmail(username), password, email_confirm: true,
      });
      if (error || !created.user) return json({ error: error?.message ?? 'Create failed' }, 400);
      const row = { id: created.user.id, username: username.trim(), role, rep_id: null, permissions: permissions ?? null };
      const { error: pErr } = await admin.from('profiles').insert(row);
      if (pErr) { await admin.auth.admin.deleteUser(created.user.id); return json({ error: pErr.message }, 400); }
      return json({ user: row });
    }

    if (action === 'set_password') {
      const target = String(body.user_id ?? '');
      if (!isAdmin && target !== callerId) return json({ error: 'Forbidden' }, 403);
      if (!validPassword(body.password)) return json({ error: 'Password must be at least 8 characters' }, 400);
      const { error } = await admin.auth.admin.updateUserById(target, { password: body.password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'update_profile') {
      const target = String(body.user_id ?? '');
      const self = target === callerId;
      if (!isAdmin && !self) return json({ error: 'Forbidden' }, 403);
      const patch: Record<string, unknown> = {};
      if (body.username !== undefined) {
        if (!validUsername(body.username)) return json({ error: 'Invalid username' }, 400);
        if (await usernameTaken(body.username, target)) return json({ error: 'Username already taken' }, 409);
        patch.username = body.username.trim();
      }
      if (isAdmin) {
        if (body.role !== undefined) {
          if (!ROLES.includes(body.role)) return json({ error: 'Invalid role' }, 400);
          if (target === callerId && body.role !== 'admin' && (await adminCount()) <= 1)
            return json({ error: 'Cannot demote the last admin' }, 400);
          patch.role = body.role;
        }
        if (body.rep_id !== undefined) patch.rep_id = body.rep_id === null ? null : Number(body.rep_id);
        if (body.permissions !== undefined) patch.permissions = body.permissions;
      }
      if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update' }, 400);
      if (patch.username) {
        const { error } = await admin.auth.admin.updateUserById(target, { email: usernameToEmail(String(patch.username)) });
        if (error) return json({ error: error.message }, 400);
      }
      const { error } = await admin.from('profiles').update(patch).eq('id', target);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'delete') {
      if (!isAdmin) return json({ error: 'Admins only' }, 403);
      const target = String(body.user_id ?? '');
      if (target === callerId) return json({ error: 'You cannot delete your own account' }, 400);
      const { data: t } = await admin.from('profiles').select('role').eq('id', target).maybeSingle();
      if (t?.role === 'admin' && (await adminCount()) <= 1) return json({ error: 'Cannot delete the last admin' }, 400);
      const { error } = await admin.auth.admin.deleteUser(target);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'Server error' }, 500);
  }
});
