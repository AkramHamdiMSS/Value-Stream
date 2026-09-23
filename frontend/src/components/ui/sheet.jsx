import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

// Right-side panel used for the resource fiche (and future detail panels).
export function Sheet({ open, onClose, title, description, children, width = 400 }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col border-l bg-card shadow-xl"
        style={{ width }}
        role="dialog"
      >
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <div className="text-base font-semibold">{title}</div>
            {description && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer"><X /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </>
  );
}

export function FieldRow({ label, children, className }) {
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      {children}
    </div>
  );
}
