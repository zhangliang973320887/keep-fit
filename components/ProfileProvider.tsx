"use client";

// Auth state is "whatever /api/auth/me returns" — we cache it in state, and
// keep it in sync via the register/login/signOut helpers. The actual JWT
// lives in an httpOnly cookie the JS side can't see, which is the point.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchMe,
  register as registerProfile,
  login as loginProfile,
  signOut as signOutProfile,
  deleteAccount as deleteAccountProfile,
  migrateLocalToServer,
  type Profile,
} from "@/lib/profile";

interface Ctx {
  /** Server-confirmed profile, or null when signed out */
  profile: Profile | null;
  /** True once the initial /api/auth/me probe has finished */
  ready: boolean;
  register: (email: string, password: string) => Promise<{ migrated: { workouts: number; history: number; settings: number } | null }>;
  login: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const ProfileContext = createContext<Ctx>({
  profile: null,
  ready: false,
  register: async () => ({ migrated: null }),
  login: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  // Probe /api/auth/me on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMe();
        if (!cancelled) setProfile(me);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const p = await registerProfile(email, password);
    // First successful sign-in is when we sweep legacy localStorage data up.
    const migrated = await migrateLocalToServer().catch(() => null);
    setProfile(p);
    return { migrated };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const p = await loginProfile(email, password);
    // Migrate in the login path too — covers the user who upgraded the app
    // and is logging into an *existing* account that has localStorage data.
    await migrateLocalToServer().catch(() => null);
    setProfile(p);
  }, []);

  const signOut = useCallback(async () => {
    await signOutProfile();
    setProfile(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await deleteAccountProfile();
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ profile, ready, register, login, signOut, deleteAccount }),
    [profile, ready, register, login, signOut, deleteAccount],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
