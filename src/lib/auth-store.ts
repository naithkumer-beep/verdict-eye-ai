// Lightweight Zustand store wrapping Supabase auth state for the whole app.
// Initialized once in __root.tsx; consumed via useAuth() in components.

import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "user" | "moderator" | "admin";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  initialized: boolean;
  bannedDialogOpen: boolean;
  setBannedDialogOpen: (open: boolean) => void;
  init: () => Promise<void>;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  role: null,
  loading: true,
  initialized: false,
  bannedDialogOpen: false,
  setBannedDialogOpen: (open) => set({ bannedDialogOpen: open }),

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  role: null,
  loading: true,
  initialized: false,

  init: async () => {
    if (get().initialized) return;
    set({ initialized: true });

    // Set up listener FIRST per Supabase guidance
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        set({ session, user: session?.user ?? null, loading: false });
        return;
      }
      set({ session, user: session?.user ?? null, loading: false });
      // Defer role fetch off the auth callback to avoid deadlocks
      if (session?.user) {
        setTimeout(() => void get().refreshRole(), 0);
      } else {
        set({ role: null });
      }
    });

    const { data } = await supabase.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      loading: false,
    });
    if (data.session?.user) {
      await get().refreshRole();
    }
  },

  refreshRole: async () => {
    const user = get().user;
    if (!user) {
      set({ role: null });
      return;
    }
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (data ?? []).map((r) => r.role as AppRole);
    const role: AppRole = roles.includes("admin")
      ? "admin"
      : roles.includes("moderator")
        ? "moderator"
        : "user";
    set({ role });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, role: null });
  },
}));

export const useAuth = () => useAuthStore((s) => s);
export const useRole = () => useAuthStore((s) => s.role);
export const useIsAdmin = () => useAuthStore((s) => s.role === "admin");
export const useIsModerator = () =>
  useAuthStore((s) => s.role === "admin" || s.role === "moderator");
