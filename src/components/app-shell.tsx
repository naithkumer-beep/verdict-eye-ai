import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Bell,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  Map as MapIcon,
  Phone,
  Trophy,
} from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AvatarDisplay } from "@/components/avatar-display";
import { ChatbotWidget } from "@/components/chatbot-widget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore, useIsModerator } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
}

const BASE_NAV: NavItem[] = [
  { to: "/reports", labelKey: "nav.reports", icon: FileText },
  { to: "/reports/new", labelKey: "nav.newReport", icon: PlusCircle },
  { to: "/map", labelKey: "nav.map", icon: MapIcon },
  { to: "/rewards", labelKey: "nav.rewards", icon: Trophy },
  { to: "/emergency", labelKey: "nav.emergency", icon: Phone },
  { to: "/notifications", labelKey: "nav.notifications", icon: Bell },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut } = useAuthStore();
  const isModerator = useIsModerator();
  const isAdmin = role === "admin";
  const { t } = useTranslation();
  const qc = useQueryClient();

  // Admins don't earn or see rewards
  const visibleBase = isAdmin ? BASE_NAV.filter((i) => i.to !== "/rewards") : BASE_NAV;
  const NAV: NavItem[] = isModerator
    ? [{ to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard }, ...visibleBase]
    : visibleBase;


  // Unread notifications count (real-time)
  const { data: unread = 0 } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user,
  });

  // Global realtime subscriber: refresh badge + toast on new notifications
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`shell-notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as { title?: string; message?: string; type?: string };
          qc.invalidateQueries({ queryKey: ["unread-notifications"] });
          qc.invalidateQueries({ queryKey: ["notifications"] });
          if (n.type === "reward_earned") {
            qc.invalidateQueries({ queryKey: ["reward-events"] });
            qc.invalidateQueries({ queryKey: ["rewards-profile"] });
            qc.invalidateQueries({ queryKey: ["reward-profile"] });
          }
          sonnerToast(n.title ?? t("notifications.fallbackTitle"), { description: n.message });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["unread-notifications"] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, qc]);

  const handleSignOut = async () => {
    await signOut();
    toast.success(t("nav.signedOut"));
    navigate({ to: "/", replace: true });
  };

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0];

  const Sidebar = (
    <aside className="flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <BrandMark />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map((item) => {
          const active =
            location.pathname === item.to ||
            (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
          const Icon = item.icon;
          const showBadge = item.to === "/notifications" && unread > 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                item.to === "/emergency" && "text-destructive hover:text-destructive",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{t(item.labelKey)}</span>
              {showBadge && (
                <Badge className="h-4 min-w-4 justify-center bg-accent px-1 font-mono text-[10px] text-accent-foreground">
                  {unread > 99 ? "99+" : require("@/lib/i18n").localNum(unread)}
                </Badge>
              )}
            </Link>
          );
        })}

        {isModerator && (
          <Link
            to="/admin"
            onClick={() => setOpen(false)}
            className={cn(
              "mt-2 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              location.pathname.startsWith("/admin")
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            {t("nav.admin")}
          </Link>
        )}

      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-md p-2">
          <AvatarDisplay
            userId={user?.id}
            name={displayName}
            email={user?.email}
            size={28}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{displayName}</div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="h-4 px-1 font-mono text-[9px] uppercase">
                {role ?? "user"}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleSignOut}
            aria-label={t("nav.signOut")}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">{Sidebar}</div>

      {open && (
        <div className="fixed inset-0 z-[1200] lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 h-full">{Sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="lg:hidden">
              <BrandMark />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild size="sm" variant="destructive" className="gap-1.5">
              <Link to="/emergency">
                <Phone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("emergency.floatingBtn")}</span>
              </Link>
            </Button>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1">{children}</main>
        <ChatbotWidget />
      </div>
    </div>
  );
}
