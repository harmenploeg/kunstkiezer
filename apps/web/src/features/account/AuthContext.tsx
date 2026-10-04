import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getClient } from "../../../../../packages/data/src/client.ts";
import { appHref } from "../../../../../packages/domain/src/navigation.ts";
interface AuthState {
  client: SupabaseClient | null;
  user: User | null;
  admin: boolean;
  loading: boolean;
  error: string;
  recovery: boolean;
  refresh: () => Promise<void>;
}
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null),
    [user, setUser] = useState<User | null>(null),
    [admin, setAdmin] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [recovery, setRecovery] = useState(false);
  async function refresh() {
    if (!client) return;
    const role = await client.rpc("kk_is_editor");
    setAdmin(!role.error && role.data === true);
  }
  useEffect(() => {
    let active = true,
      serial = 0;
    let off: (() => void) | undefined;
    getClient()
      .then((c) => {
        if (!active) return;
        setClient(c);
        async function inspect() {
          const turn = ++serial;
          try {
            const session = await c.auth.getSession();
            if (session.error) throw session.error;
            const verified = session.data.session
              ? await c.auth.getUser()
              : null;
            if (verified?.error) throw verified.error;
            const next = verified?.data.user ?? null;
            const role = next ? await c.rpc("kk_is_editor") : null;
            if (!active || turn !== serial) return;
            setUser(next);
            setAdmin(role?.data === true && !role.error);
            setError("");
            setLoading(false);
          } catch {
            if (active && turn === serial) {
              setUser(null);
              setAdmin(false);
              setError(
                "Je account kon niet worden gecontroleerd. Probeer de pagina opnieuw te laden.",
              );
              setLoading(false);
            }
          }
        }
        const listener = c.auth.onAuthStateChange((event, session) => {
          if (event === "PASSWORD_RECOVERY") setRecovery(true);
          if (event === "SIGNED_OUT") {
            setUser(null);
            setAdmin(false);
            setRecovery(false);
          }
          // Supabase callbacks must finish before making another Auth request.
          setTimeout(() => {
            if (active) void inspect();
          }, 0);
        });
        off = () => listener.data.subscription.unsubscribe();
        void inspect();
        const focus = () => void inspect();
        window.addEventListener("focus", focus);
        const original = off;
        off = () => {
          original();
          window.removeEventListener("focus", focus);
        };
      })
      .catch(() => {
        if (active) {
          setError("Geen verbinding met de accountdatabase.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
      serial++;
      off?.();
    };
  }, []);
  return (
    <Context.Provider
      value={{ client, user, admin, loading, error, recovery, refresh }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw Error("AuthProvider ontbreekt");
  return value;
}
export function RequireAdmin({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.loading) return <p role="status">Account controleren…</p>;
  if (!auth.user)
    return (
      <p>
        Log in met je beheerdersaccount.{" "}
        <a href={appHref("/account")}>Inloggen</a>
      </p>
    );
  if (!auth.admin)
    return <p>Deze pagina is alleen beschikbaar voor beheerders.</p>;
  return <>{children}</>;
}
