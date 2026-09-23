import { cn } from "../../lib/utils";

export function SelectNative({ className, children, ...props }) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
