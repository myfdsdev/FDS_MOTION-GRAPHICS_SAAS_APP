import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TooltipProps {
  /** Tooltip body text. */
  content: ReactNode;
  /** Optional keyboard hint rendered as a small kbd chip. */
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
  className?: string;
}

const SIDE_CLASSES: Record<NonNullable<TooltipProps["side"]>, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

/**
 * Lightweight hover/focus tooltip (no Radix dependency). Wrap any control.
 */
export function Tooltip({ content, shortcut, side = "top", children, className }: TooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "pointer-events-none absolute z-50 flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface-3 px-2 py-1 text-xs text-fg shadow-lg",
              SIDE_CLASSES[side]
            )}
          >
            {content}
            {shortcut && (
              <kbd className="rounded border border-border-soft bg-surface-2 px-1 text-[10px] font-medium text-muted">
                {shortcut}
              </kbd>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
