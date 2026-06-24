// Avatar that resolves avatar_url from the profiles table (signed URL for storage paths).
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function AvatarDisplay({
  userId,
  name,
  email,
  className,
  size = 28,
  avatarUrl,
}: {
  userId?: string;
  name?: string | null;
  email?: string | null;
  className?: string;
  size?: number;
  avatarUrl?: string | null;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (avatarUrl) {
        if (avatarUrl.startsWith("http")) {
          if (!cancelled) setSrc(avatarUrl);
        } else {
          const { data } = await supabase.storage
            .from("avatars")
            .createSignedUrl(avatarUrl, 60 * 60);
          if (!cancelled) setSrc(data?.signedUrl ?? null);
        }
        return;
      }
      if (!userId) return;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();
      const url = data?.avatar_url;
      if (!url) {
        if (!cancelled) setSrc(null);
        return;
      }
      if (url.startsWith("http")) {
        if (!cancelled) setSrc(url);
      } else {
        const { data: s } = await supabase.storage
          .from("avatars")
          .createSignedUrl(url, 60 * 60);
        if (!cancelled) setSrc(s?.signedUrl ?? null);
      }
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [userId, avatarUrl]);

  const initials =
    name
      ?.split(" ")
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() ??
    email?.[0]?.toUpperCase() ??
    "U";

  return (
    <Avatar
      className={cn(className)}
      style={{ width: size, height: size }}
    >
      {src && <AvatarImage src={src} alt={name ?? email ?? "User"} />}
      <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
