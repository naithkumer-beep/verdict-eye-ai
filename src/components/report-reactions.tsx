import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/lib/auth-store";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ReportReactions({ reportId }: { reportId: string }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [counts, setCounts] = useState({ like: 0, dislike: 0 });
  const [mine, setMine] = useState<"like" | "dislike" | null>(null);

  const refresh = async () => {
    const { data } = await supabase
      .from("report_reactions")
      .select("user_id,reaction")
      .eq("report_id", reportId);
    const rows = data ?? [];
    setCounts({
      like: rows.filter((r) => r.reaction === "like").length,
      dislike: rows.filter((r) => r.reaction === "dislike").length,
    });
    setMine(
      (rows.find((r) => r.user_id === user?.id)?.reaction as
        | "like"
        | "dislike"
        | undefined) ?? null,
    );
  };

  useEffect(() => {
    void refresh();
    const ch = supabase
      .channel(`reactions-${reportId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "report_reactions", filter: `report_id=eq.${reportId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, user?.id]);

  const react = async (kind: "like" | "dislike") => {
    if (!user) {
      toast.error(t("reactions.signIn"));
      return;
    }
    if (mine === kind) {
      await supabase
        .from("report_reactions")
        .delete()
        .eq("report_id", reportId)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("report_reactions")
        .upsert(
          { report_id: reportId, user_id: user.id, reaction: kind },
          { onConflict: "report_id,user_id" },
        );
    }
    void refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={mine === "like" ? "default" : "outline"}
        size="sm"
        onClick={() => react("like")}
        className={cn("gap-1.5", mine === "like" && "bg-success hover:bg-success/90")}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        <span className="tabular-nums">{counts.like}</span>
        <span className="hidden sm:inline">{t("reactions.like")}</span>
      </Button>
      <Button
        variant={mine === "dislike" ? "default" : "outline"}
        size="sm"
        onClick={() => react("dislike")}
        className={cn("gap-1.5", mine === "dislike" && "bg-destructive hover:bg-destructive/90")}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
        <span className="tabular-nums">{counts.dislike}</span>
        <span className="hidden sm:inline">{t("reactions.dislike")}</span>
      </Button>
    </div>
  );
}
