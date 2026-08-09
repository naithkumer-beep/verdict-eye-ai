// Integration-managed protected layout. Client-only gate, redirects to /auth.
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Wait for the persisted session to be restored before deciding the user is
    // signed out. On a cold production load getSession() can briefly resolve
    // null while storage is being read / the token refreshed.
    let session = (await supabase.auth.getSession()).data.session;
    for (let i = 0; i < 3 && !session; i++) {
      await new Promise((r) => setTimeout(r, 150));
      session = (await supabase.auth.getSession()).data.session;
    }

    if (session) {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return { user: data.user };
    }

    throw redirect({
      to: "/auth",
      search: { redirect: location.href } as never,
    });
  },

  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
