import { cn } from "../../lib/utils";

export function Table({ className, ...props }) {
  return (
    <div className="relative w-full overflow-auto rounded-xl border bg-card shadow-sm">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
export function THead({ className, ...props }) {
  return <thead className={cn("[&_tr]:border-b [&_tr]:bg-muted/50", className)} {...props} />;
}
export function TBody({ className, ...props }) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
export function TR({ className, ...props }) {
  return <tr className={cn("border-b transition-colors hover:bg-muted/40", className)} {...props} />;
}
export function TH({ className, ...props }) {
  return <th className={cn("h-10 px-3 text-left align-middle text-xs font-semibold text-muted-foreground", className)} {...props} />;
}
export function TD({ className, ...props }) {
  return <td className={cn("px-3 py-2 align-middle", className)} {...props} />;
}
