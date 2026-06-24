import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 12 L9 6 L15 14 L21 8" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="font-mono text-[13px] font-semibold tracking-tight">CIAP</div>
        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Impact Analysis
        </div>
      </div>
    </div>
  );
}
