export type AppEnvironment = "development" | "staging" | "production";

export interface PublicConfiguration {
  environment: AppEnvironment;
  supabaseUrl: string;
  supabasePublishableKey: string;
}

/** Selecteert uitsluitend publieke waarden; neemt nooit het hele env-object over. */
export function readPublicConfiguration(
  variables: Readonly<Record<string, string | undefined>>,
): PublicConfiguration {
  const environment = variables.APP_ENV;
  if (environment !== "development" && environment !== "staging" && environment !== "production") {
    throw new Error("APP_ENV moet development, staging of production zijn.");
  }
  const supabaseUrl = variables.PUBLIC_SUPABASE_URL?.trim();
  const key = variables.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl) throw new Error("PUBLIC_SUPABASE_URL ontbreekt.");
  let url: URL;
  try { url = new URL(supabaseUrl); }
  catch { throw new Error("PUBLIC_SUPABASE_URL is ongeldig."); }
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !(environment === "development" && isLocal && url.protocol === "http:"))) {
    throw new Error("Supabase vereist HTTPS, behalve lokaal tijdens ontwikkeling.");
  }
  if (!key?.startsWith("sb_publishable_")) {
    throw new Error("Gebruik een Supabase publishable key; serverkeys zijn niet toegestaan.");
  }
  return { environment, supabaseUrl: url.toString(), supabasePublishableKey: key };
}
