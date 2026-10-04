import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  PROFILE_KEY,
  parseProfile,
  emptyProfile,
  type TasteProfile,
} from "../../../../../packages/domain/src/profile.ts";
import { useAuth } from "../account/AuthContext.tsx";
export function readProfile(): TasteProfile {
  try {
    return parseProfile(localStorage.getItem(PROFILE_KEY));
  } catch {
    return emptyProfile();
  }
}
interface ProfileState {
  profile: TasteProfile;
  ready: boolean;
  error: string;
  version: string | null;
  save: (value: TasteProfile, version: string | null) => Promise<void>;
  importGuest: () => Promise<void>;
}
const Context = createContext<ProfileState | null>(null);
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { client, user, loading } = useAuth(),
    [profile, setProfile] = useState(emptyProfile),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [version, setVersion] = useState<string | null>(null);
  const mutations = useRef(0);
  const owner = useRef<string | null>(null);
  owner.current = user?.id ?? null;
  useEffect(() => {
    if (loading) return;
    let active = true;
    setReady(false);
    setProfile(emptyProfile());
    setVersion(null);
    setError("");
    async function load() {
      const revision = mutations.current;
      if (!user || !client) {
        if (active) {
          setProfile(readProfile());
          setReady(true);
        }
        return;
      }
      const { data, error } = await client
        .from("kk_profiles")
        .select("tags,completed,updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active || revision !== mutations.current) return;
      if (error) {
        setError(
          "Je online profiel kon niet worden geladen. Herlaad de pagina; je opgeslagen gegevens blijven behouden.",
        );
        return;
      }
      setProfile(
        data
          ? { version: 1, tags: data.tags, completed: data.completed }
          : emptyProfile(),
      );
      setVersion(data?.updated_at ?? null);
      setReady(true);
    }
    void load();
    const focus = () => void load();
    window.addEventListener("focus", focus);
    const storage = (e: StorageEvent) => {
      if (!user && e.key === PROFILE_KEY) void load();
    };
    window.addEventListener("storage", storage);
    return () => {
      active = false;
      window.removeEventListener("focus", focus);
      window.removeEventListener("storage", storage);
    };
  }, [client, user?.id, loading]);
  async function save(value: TasteProfile, expected: string | null) {
    if (!ready || loading) throw Error("Wacht totdat je profiel is geladen.");
    const uid = user?.id ?? null;
    if (uid && client) {
      const { data, error } = await client
        .rpc("kk_save_profile", {
          new_tags: value.tags,
          is_completed: value.completed,
          expected_updated_at: expected,
        })
        .single();
      if (error)
        throw Error(
          error.code === "40001"
            ? "Je profiel is op een ander apparaat gewijzigd. Herlaad de pagina en pas je voorkeuren opnieuw aan."
            : "Opslaan is niet gelukt. Je wijzigingen staan nog in het formulier.",
        );
      if (owner.current !== uid)
        throw Error("Je account is gewijzigd. Herlaad de pagina.");
      setVersion((data as { updated_at: string }).updated_at);
    } else {
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(value));
      } catch {
        throw Error(
          "Je browser kon het profiel niet bewaren. Sta lokale opslag toe of log in.",
        );
      }
    }
    mutations.current++;
    setProfile(value);
    setError("");
  }
  const value = {
    profile,
    ready,
    error,
    version,
    save,
    importGuest: () => save(readProfile(), version),
  };
  return createElement(Context.Provider, { value }, children);
}
export function useProfileState() {
  const value = useContext(Context);
  if (!value) throw Error("ProfileProvider ontbreekt");
  return value;
}
export function useProfile() {
  return useProfileState().profile;
}
