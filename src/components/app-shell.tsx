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
} from "lucide-react";
import { useState, type ReactNode } from "react";
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

const NAV: NavItem[] = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/reports", labelKey: "nav.reports", icon: FileText },
  { to: "/reports/new", labelKey: "nav.newReport", icon: PlusCircle },
  { to: "/map", labelKey: "nav.map", icon: MapIcon },
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
  const { t } = useTranslation();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
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
              {t(item.labelKey)}
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
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0">{Sidebar}</div>
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
