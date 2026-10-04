interface AuthUser {
  id: string;
  email?: string;
}
interface Verifier {
  auth: {
    getUser(
      token: string,
    ): Promise<{ data: { user: AuthUser | null }; error: unknown }>;
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): Promise<{ data: { user: AuthUser | null }; error: unknown }>;
    signOut(options: { scope: "local" }): Promise<unknown>;
  };
}
interface Administrator {
  auth: { admin: { deleteUser(id: string): Promise<{ error: unknown }> } };
}
interface Dependencies {
  verifier: () => Verifier;
  administrator: () => Administrator;
}
const allowedOrigins = new Set([
  "https://www.loci-amsterdam.nl",
  "https://loci-amsterdam.nl",
  "https://kunstkiezer.pages.dev",
]);
/** Service-role operations always follow both token and password verification. */
export async function deleteAccount(
  req: Request,
  deps: Dependencies,
): Promise<Response> {
  const origin = req.headers.get("origin") ?? "";
  const headers = {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://www.loci-amsterdam.nl",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
  const response = (data: unknown, status = 200) =>
    Response.json(data, { status, headers });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST" || !allowedOrigins.has(origin))
    return response({ error: "Niet toegestaan." }, 403);
  try {
    const client = deps.verifier();
    const token = (req.headers.get("authorization") ?? "").replace(
      /^Bearer /i,
      "",
    );
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user?.email)
      return response({ error: "Log opnieuw in." }, 401);
    const body = await req.json();
    if (typeof body.password !== "string" || body.password.length > 512)
      return response({ error: "Wachtwoord vereist." }, 400);
    // Supabase Auth rate-limits password checks. Credentials never enter logs.
    const verified = await client.auth.signInWithPassword({
      email: data.user.email,
      password: body.password,
    });
    if (verified.error || verified.data.user?.id !== data.user.id)
      return response(
        {
          error:
            "Het wachtwoord klopt niet. Probeer later opnieuw bij te veel pogingen.",
        },
        401,
      );
    try {
      const deleted = await deps
        .administrator()
        .auth.admin.deleteUser(data.user.id);
      if (deleted.error)
        return response(
          {
            error:
              "Verwijderen is niet gelukt. Als je de laatste beheerder bent, draag dan eerst het beheer over.",
          },
          409,
        );
      return response({ deleted: true });
    } finally {
      // Only discard this verification session, including when the last-admin guard rejects deletion.
      try {
        await client.auth.signOut({ scope: "local" });
      } catch {
        /* Deletion outcome remains authoritative. */
      }
    }
  } catch {
    return response(
      { error: "Verwijderen is niet gelukt. Probeer opnieuw." },
      400,
    );
  }
}
