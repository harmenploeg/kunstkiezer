import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { deleteAccount } from "./handler.ts";
Deno.serve((req: Request) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  // Fresh clients per request; never share one visitor's session with another request.
  return deleteAccount(req, {
    verifier: () =>
      createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, options),
    administrator: () =>
      createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, options),
  });
});
