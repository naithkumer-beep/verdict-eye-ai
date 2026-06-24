// Citizen feedback modal: 1-5 star rating + comment after a report is resolved.
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type Props = {
  reportId: string;
  ownerId: string;
  status: string;
};

export function FeedbackModal({ reportId, ownerId, status }: Props) {
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || user.id !== ownerId || status !== "resolved") return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("report_feedback")
        .select("id")
        .eq("report_id", reportId)
        .maybeSingle();
      if (!cancelled) {
        setExisting(!!data);
        if (!data) setOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user, ownerId, status, reportId]);

  if (!user || user.id !== ownerId || status !== "resolved" || existing) return null;

  const submit = async () => {
    if (rating < 1) {
      toast.error(t("feedback.pickStar", "Please pick a rating"));
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("report_feedback").insert({
      report_id: reportId,
      user_id: user.id,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("feedback.thanks", "Thanks for your feedback!"));
    setExisting(true);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("feedback.title", "How did we do?")}</DialogTitle>
          <DialogDescription>
            {t("feedback.subtitle", "Your report was resolved. Rate the response.")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-1 py-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-1"
              aria-label={`${n} stars`}
            >
              <Star
                className={`h-8 w-8 transition-colors ${
                  (hover || rating) >= n ? "fill-warning text-warning" : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
        <Textarea
          placeholder={t("feedback.comment", "Optional comment")}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>{t("common.later", "Later")}</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? t("common.saving", "Saving…") : t("feedback.submit", "Submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
