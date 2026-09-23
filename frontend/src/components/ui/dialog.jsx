import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

// Minimal dialog primitive in the shadcn style (native <dialog> avoided:
// closes only via our own controls, keeps styling predictable).
export function Dialog({ open, onClose, title, description, children, width = 340 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn("relative rounded-xl border bg-card shadow-lg p-6")} style={{ width }} role="dialog">
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="text-[15px] font-semibold tracking-tight">{title}</div>
            {description && <div className="text-xs text-muted-foreground mt-1">{description}</div>}
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer" className="h-7 w-7 text-muted-foreground">
              <X size={14} />
            </Button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
