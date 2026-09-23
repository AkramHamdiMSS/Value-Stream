import { cn } from "../../lib/utils";

export function Card({ className, ...props }) {
  return <div className={cn("bg-card text-card-foreground rounded-xl border shadow-sm", className)} {...props} />;
}
export function CardHeader({ className, ...props }) {
  return <div className={cn("flex flex-col gap-1 p-5", className)} {...props} />;
}
export function CardTitle({ className, ...props }) {
  return <div className={cn("text-sm font-semibold leading-none", className)} {...props} />;
}
export function CardDescription({ className, ...props }) {
  return <div className={cn("text-xs text-muted-foreground", className)} {...props} />;
}
export function CardContent({ className, ...props }) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}
