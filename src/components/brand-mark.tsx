import { cn } from "@/lib/utils";
import logo from "@/assets/civiclens-logo.png.asset.json";

export function BrandMark({
  className,
  showText = true,
  size = "sm",
}: {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "h-12 w-12" : size === "md" ? "h-9 w-9" : "h-8 w-8";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src={logo.url}
        alt="CivicLens AI"
        className={cn(dim, "rounded-md object-contain")}
      />
      {showText && (
        <div className="leading-tight">
          <div className="font-mono text-[13px] font-semibold tracking-tight">
            CivicLens <span className="text-accent">AI</span>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Yangon · Myanmar
          </div>
        </div>
      )}
    </div>
  );
}
