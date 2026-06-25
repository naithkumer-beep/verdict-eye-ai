// Authentication page — email/password + Google OAuth.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Loader2, Mail, Lock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup", "reset"]).optional().default("signin"),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — CIAP" },
      { name: "description", content: "Sign in or create a CIAP account." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().email("Enter a valid email").max(255);
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long");

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  const [mode, setMode] = useState<"signin" | "signup" | "reset">(search.mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [bannedOpen, setBannedOpen] = useState(false);

  const isBanError = (msg: string) =>
    /ban(ned)?|user_banned/i.test(msg);

  useEffect(() => {
    if (initialized && user) {
      navigate({ to: search.redirect ?? "/reports", replace: true });
    }
  }, [user, initialized, navigate, search.redirect]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      toast.error(parsedEmail.error.issues[0].message);
      return;
    }

    if (mode === "reset") {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password reset link sent");
        setMode("signin");
      }
      return;
    }

    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) {
      toast.error(parsedPassword.error.issues[0].message);
      return;
    }

    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/reports`,
          data: { full_name: name || email.split("@")[0] },
        },
      });
      setLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Account created — check your email to verify.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        if (isBanError(error.message)) {
          setBannedOpen(true);
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Welcome back");
        navigate({ to: search.redirect ?? "/reports", replace: true });
      }
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      const msg = result.error.message ?? "Sign in failed";
      if (isBanError(msg)) {
        setBannedOpen(true);
      } else {
        toast.error(msg);
      }
      return;
    }
    if (result.redirected) return;
    navigate({ to: search.redirect ?? "/reports", replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="bg-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black,transparent)]" />

      <header className="relative z-10 flex h-14 items-center justify-between border-b border-border px-4 lg:px-8">
        <BrandMark />
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-elevated)] sm:p-8"
        >
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signup"
              ? "Create your account"
              : mode === "reset"
                ? "Reset your password"
                : "Sign in to CIAP"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Start validating reports in under a minute."
              : mode === "reset"
                ? "We'll email you a secure reset link."
                : "Welcome back to your impact dashboard."}
          </p>

          {mode !== "reset" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="mt-6 w-full"
                onClick={handleGoogle}
                disabled={loading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3.1.6 4.3 1.6l3.2-3.1C17.4 1.6 14.9.5 12 .5 7.4.5 3.4 3 1.4 6.8l3.7 2.9C6.1 6.9 8.8 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6l3.6 2.8c2.1-1.9 3.3-4.8 3.3-8.1z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.1 14.3a7.2 7.2 0 0 1 0-4.6L1.4 6.8a12 12 0 0 0 0 10.4l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23.5c3.2 0 5.9-1.1 7.9-2.9l-3.6-2.8c-1 .7-2.3 1.1-4.3 1.1-3.2 0-5.9-2.1-6.9-5.1l-3.7 2.9C3.4 21 7.4 23.5 12 23.5z"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  or with email
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  maxLength={100}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-9"
                />
              </div>
            </div>

            {mode !== "reset" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("reset")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={8}
                    className="pl-9"
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signup"
                ? "Create account"
                : mode === "reset"
                  ? "Send reset link"
                  : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
