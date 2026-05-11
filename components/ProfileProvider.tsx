"use client";

// Holds the currently-active profile email in React context, so that:
//   1. The Nav can render the profile chip / switcher
//   2. Pages can re-fetch their data (workouts/history) when the user switches
//      profiles — they subscribe to the email and re-run their effects.
//
// Without this, switching profiles wouldn't trigger any UI updates because
// localStorage changes don't notify React.

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
  getActiveEmail,
  getProfiles,
  signIn as signInProfile,
  signOut as signOutProfile,
  removeProfile,
  type Profile,
} from "@/lib/profile";

interface Ctx {
  /** null while SSR / before hydration */
  activeEmail: string | null;
  /** all profiles known on this device */
  profiles: Profile[];
  /** has the client mounted? (avoid SSR/CSR flash) */
  ready: boolean;
  /** create-or-switch profile. Returns whether legacy data was migrated. */
  signIn: (email: string) => { migrated: boolean };
  /** clear the active profile (keeps localStorage data) */
  signOut: () => void;
  /** delete a profile and ALL its data from this device */
  deleteProfile: (email: string) => void;
}

const ProfileContext = createContext<Ctx>({
  activeEmail: null,
  profiles: [],
  ready: false,
  signIn: () => ({ migrated: false }),
  signOut: () => {},
  deleteProfile: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [activeEmail, setActiveEmailState] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage on first mount (avoids SSR mismatch).
  useEffect(() => {
    setActiveEmailState(getActiveEmail());
    setProfiles(getProfiles());
    setReady(true);
  }, []);

  // Cross-tab sync: another tab signing in/out should be reflected here.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onStorage(e: StorageEvent) {
      if (
        e.key === "mwc.profile.active.v1" ||
        e.key === "mwc.profiles.v1"
      ) {
        setActiveEmailState(getActiveEmail());
        setProfiles(getProfiles());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const signIn = useCallback((email: string) => {
    const { profile, migrated } = signInProfile(email);
    setActiveEmailState(profile.email);
    setProfiles(getProfiles());
    return { migrated };
  }, []);

  const signOut = useCallback(() => {
    signOutProfile();
    setActiveEmailState(null);
  }, []);

  const deleteProfile = useCallback((email: string) => {
    removeProfile(email);
    setActiveEmailState(getActiveEmail());
    setProfiles(getProfiles());
  }, []);

  const value = useMemo(
    () => ({ activeEmail, profiles, ready, signIn, signOut, deleteProfile }),
    [activeEmail, profiles, ready, signIn, signOut, deleteProfile],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
