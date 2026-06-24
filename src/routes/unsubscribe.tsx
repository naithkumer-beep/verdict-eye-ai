import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({ meta: [{ title: "Unsubscribe — CivicLens AI" }] }),
  component: UnsubscribePage,
});

type State = "loading" | "ready" | "done" | "invalid" | "already" | "error";

function UnsubscribePage() {
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState<string | null>(null);

  const token =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token")
      : null;

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setState("invalid");
          return;
        }
        if (j.alreadyUnsubscribed) setState("already");
        else {
          setEmail(j.email ?? null);
          setState("ready");
        }
      })
      .catch(() => setState("error"));
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState("loading");
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(r.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Unsubscribe</h1>
        {state === "loading" && (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        )}
        {state === "ready" && (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              {email
                ? `Unsubscribe ${email} from CivicLens AI emails?`
                : "Unsubscribe from CivicLens AI emails?"}
            </p>
            <Button className="mt-4" onClick={confirm}>
              Confirm unsubscribe
            </Button>
          </>
        )}
        {state === "done" && (
          <p className="mt-3 text-sm text-muted-foreground">
            You've been unsubscribed. We're sorry to see you go.
          </p>
        )}
        {state === "already" && (
          <p className="mt-3 text-sm text-muted-foreground">
            This address is already unsubscribed.
          </p>
        )}
        {state === "invalid" && (
          <p className="mt-3 text-sm text-muted-foreground">
            This unsubscribe link is invalid or has expired.
          </p>
        )}
        {state === "error" && (
          <p className="mt-3 text-sm text-destructive">
            Something went wrong. Please try again later.
          </p>
        )}
      </Card>
    </div>
  );
}
