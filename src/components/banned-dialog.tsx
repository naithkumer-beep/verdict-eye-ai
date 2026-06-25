// Global popup shown when the current account is detected as banned.
// Triggered by failed sign-in attempts and by background re-validation.
import { Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuthStore } from "@/lib/auth-store";

export function BannedDialog() {
  const { t } = useTranslation();
  const open = useAuthStore((s) => s.bannedDialogOpen);
  const setOpen = useAuthStore((s) => s.setBannedDialogOpen);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10">
            <Ban className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">
            {t("banned.title")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {t("banned.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setOpen(false)} className="w-full">
            {t("banned.action")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
