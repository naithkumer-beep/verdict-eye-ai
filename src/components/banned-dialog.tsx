// Global popup shown when the current account is detected as banned.
// Triggered by failed sign-in attempts and by background re-validation.
import { Ban } from "lucide-react";
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
            Your account is banned
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Your account has been banned by an administrator. You have been signed
            out and can no longer access the platform. If you believe this is a
            mistake, please contact support to appeal.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setOpen(false)} className="w-full">
            Understood
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
