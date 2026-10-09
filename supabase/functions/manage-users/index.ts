import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { manageUsers } from './handler.ts';
Deno.serve((req: Request) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const auth = { persistSession: false, autoRefreshToken: false };
  return manageUsers(req, {
    caller: token => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth, global: { headers: { Authorization: `Bearer ${token}` } } }),
    administrator: () => createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth }),
  });
});
