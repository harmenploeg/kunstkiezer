interface Result { error: { message?: string; code?: string } | null }
interface Member { user_id: string; email: string; is_admin: boolean }
interface Caller {
  auth: { getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}
interface Administrator {
  auth: { admin: {
    inviteUserByEmail(email: string, options: { redirectTo: string }): Promise<Result & { data: { user: { id: string } | null } }>;
    deleteUser(id: string): Promise<Result>;
  } };
}
interface Dependencies { caller(token: string): Caller; administrator(): Administrator }
const origins = new Set(['https://www.loci-amsterdam.nl', 'https://loci-amsterdam.nl', 'https://kunstkiezer.pages.dev']);
/** Authorization comes from the current database role, never from user metadata. */
export async function manageUsers(req: Request, deps: Dependencies): Promise<Response> {
  const origin = req.headers.get('origin') ?? '';
  const headers = {
    'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'https://www.loci-amsterdam.nl',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin', 'Cache-Control': 'no-store',
  };
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST' || !origins.has(origin)) return reply({ error: 'Niet toegestaan.' }, 403);
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply({ error: 'Log opnieuw in.' }, 401);
  try {
    const caller = deps.caller(token);
    const verified = await caller.auth.getUser(token);
    if (verified.error || !verified.data.user) return reply({ error: 'Log opnieuw in.' }, 401);
    const role = await caller.rpc('kk_is_editor');
    if (role.error || role.data !== true) return reply({ error: 'Alleen beheerders kunnen gebruikers beheren.' }, 403);
    const body = await req.json();
    if (body?.action === 'invite') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: 'Vul een geldig e-mailadres in.' }, 400);
      const members = await caller.rpc('kk_list_members');
      if (members.error || !Array.isArray(members.data)) return reply({ error: 'Gebruikers konden niet worden gecontroleerd. Probeer opnieuw.' }, 503);
      if ((members.data as Member[]).some(member => member.email?.toLowerCase() === email)) return reply({ error: 'Dit account bestaat al. Pas de rechten aan in de gebruikerslijst.' }, 409);
      const result = await deps.administrator().auth.admin.inviteUserByEmail(email, { redirectTo: 'https://www.loci-amsterdam.nl/kunstkiezer/account' });
      if (result.error || !result.data.user) return reply({ error: 'Uitnodigen is niet gelukt. Controleer of het account al bestaat en of e-mailverzending in Supabase is ingesteld; probeer daarna opnieuw.' }, 409);
      // New accounts start without editorial privileges. Assign rights separately after creation.
      return reply({ invited: true, user_id: result.data.user.id });
    }
    if (body?.action === 'delete') {
      const id = body.user_id;
      if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return reply({ error: 'Ongeldige gebruiker.' }, 400);
      if (id === verified.data.user.id) return reply({ error: 'Verwijder je eigen account via Mijn account. Draag het beheer zo nodig eerst over.' }, 409);
      const members = await caller.rpc('kk_list_members');
      if (members.error || !Array.isArray(members.data)) return reply({ error: 'Gebruikers konden niet worden gecontroleerd. Probeer opnieuw.' }, 503);
      if (!(members.data as Member[]).some(member => member.user_id === id)) return reply({ error: 'Deze gebruiker bestaat niet meer. Laad de lijst opnieuw.' }, 404);
      // Revoke access before deletion: even an unexpired JWT cannot retain editor rights.
      // The database serializes role changes and protects the last administrator.
      const revoke = await caller.rpc('kk_set_admin', { member_id: id, allowed: false });
      if (revoke.error) return reply({ error: 'Rechten intrekken is niet gelukt. Het account is niet verwijderd; de laatste beheerder moet behouden blijven.' }, 409);
      const result = await deps.administrator().auth.admin.deleteUser(id);
      if (result.error) return reply({ error: 'De beheerdersrechten zijn ingetrokken, maar het account kon niet worden verwijderd. Laad de lijst opnieuw en probeer verwijderen nogmaals.' }, 409);
      return reply({ deleted: true });
    }
    return reply({ error: 'Onbekende gebruikersactie.' }, 400);
  } catch {
    return reply({ error: 'Gebruikersbeheer is niet gelukt. Laad de lijst opnieuw voordat je het opnieuw probeert.' }, 400);
  }
}
