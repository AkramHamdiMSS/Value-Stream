import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// The shadcn convention: merge conditional class names while resolving
// Tailwind conflicts (later classes win).
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
