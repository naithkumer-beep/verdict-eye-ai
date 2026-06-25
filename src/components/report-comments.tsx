import { useEffect, useState } from "react";
import { Send, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { AvatarDisplay } from "@/components/avatar-display";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, useIsAdmin } from "@/lib/auth-store";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface CommentRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

export function ReportComments({ reportId }: { reportId: string }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = useIsAdmin();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("report_comments")
      .select("id,user_id,content,created_at")
      .eq("report_id", reportId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as CommentRow[];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,display_name,email,avatar_url")
        .in("id", userIds);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      for (const r of rows) {
        const p = byId.get(r.user_id);
        r.profile = p
          ? { display_name: p.display_name, email: p.email, avatar_url: p.avatar_url }
          : null;
      }
    }
    setComments(rows);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`comments-${reportId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "report_comments", filter: `report_id=eq.${reportId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const post = async () => {
    if (!user) {
      toast.error(t("comments.signInToComment"));
      return;
    }
    const content = text.trim();
    if (!content) return;
    setPosting(true);
    const { error } = await supabase
      .from("report_comments")
      .insert({ report_id: reportId, user_id: user.id, content });
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
  };

  const del = async (id: string, uid: string) => {
    if (uid !== user?.id && !isAdmin) return;
    if (!confirm(t("comments.confirmDelete"))) return;
    const { error } = await supabase.from("report_comments").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{t("comments.title")}</div>
        <div className="font-mono text-xs text-muted-foreground tabular-nums">
          {comments.length}
        </div>
      </div>

      {user ? (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("comments.placeholder")}
            rows={2}
            maxLength={2000}
          />
          <div className="flex justify-end">
            <Button onClick={post} disabled={posting || !text.trim()} size="sm">
              {posting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
              {t("comments.post")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {comments.length === 0 && (
          <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {t("comments.empty")}
          </div>
        )}
        {comments.map((c) => {
          const canDelete = c.user_id === user?.id || isAdmin;
          return (
            <div key={c.id} className="flex gap-3 border-t border-border pt-3 first:border-0 first:pt-0">
              <AvatarDisplay
                userId={c.user_id}
                name={c.profile?.display_name ?? null}
                email={c.profile?.email ?? null}
                avatarUrl={c.profile?.avatar_url ?? null}
                size={32}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {c.profile?.display_name ?? c.profile?.email?.split("@")[0] ?? "User"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => del(c.id, c.user_id)}
                      aria-label={t("comments.delete")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{c.content}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
