// User settings — profile + avatar upload.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AvatarDisplay } from "@/components/avatar-display";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — CivicLens AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarKey, setAvatarKey] = useState(0); // force refresh

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, bio, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      }
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        email: user.email,
      });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success(t("settings.profileSaved"));
  };

  const onPickAvatar = async (file: File | null) => {
    if (!file || !user) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error(t("settings.useImageType"));
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error(t("settings.max4mb"));
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;

      // Remove old avatar if it was in storage
      if (avatarUrl && !avatarUrl.startsWith("http")) {
        await supabase.storage.from("avatars").remove([avatarUrl]);
      }

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", user.id);
      if (profErr) throw profErr;

      setAvatarUrl(path);
      setAvatarKey((k) => k + 1);
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    if (!user || !avatarUrl) return;
    setUploadingAvatar(true);
    try {
      if (!avatarUrl.startsWith("http")) {
        await supabase.storage.from("avatars").remove([avatarUrl]);
      }
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
      setAvatarUrl(null);
      setAvatarKey((k) => k + 1);
      toast.success("Photo removed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 lg:px-8 lg:py-8">
      <div>
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {t("settings.profile")}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("nav.settings")}
        </h1>
      </div>

      {/* Avatar card */}
      <Card className="space-y-4 p-5">
        <div className="text-sm font-medium">{t("settings.avatar")}</div>
        <div className="flex items-center gap-4">
          <AvatarDisplay
            key={avatarKey}
            userId={user?.id}
            name={displayName}
            email={user?.email}
            avatarUrl={avatarUrl}
            size={72}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t("settings.uploadAvatar")}
            </Button>
            {avatarUrl && (
              <Button variant="ghost" size="sm" onClick={removeAvatar} disabled={uploadingAvatar}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t("settings.removeAvatar")}
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP — max 4 MB.</p>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <div className="text-sm font-medium">Account</div>
          <div className="mt-1 text-xs text-muted-foreground">{user?.email}</div>
          <div className="mt-2 flex gap-1.5">
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              {role ?? "user"}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              {user?.app_metadata?.provider ?? "email"}
            </Badge>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dn">Display name</Label>
          <Input
            id="dn"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Aung Aung"
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Tell others about yourself."
          />
        </div>
        <Button onClick={save} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("common.save")}
        </Button>
      </Card>
    </div>
  );
}
