import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

const OFFSET = 8;
const VIEWPORT_GAP = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function measurePosition(
  trigger: DOMRect,
  tooltip: DOMRect,
  side: NonNullable<TooltipProps["side"]>
): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let actualSide = side;

  if (side === "bottom" && trigger.bottom + OFFSET + tooltip.height > vh - VIEWPORT_GAP) {
    actualSide = "top";
  } else if (side === "top" && trigger.top - OFFSET - tooltip.height < VIEWPORT_GAP) {
    actualSide = "bottom";
  } else if (side === "right" && trigger.right + OFFSET + tooltip.width > vw - VIEWPORT_GAP) {
    actualSide = "left";
  } else if (side === "left" && trigger.left - OFFSET - tooltip.width < VIEWPORT_GAP) {
    actualSide = "right";
  }

  let top = trigger.top + trigger.height / 2 - tooltip.height / 2;
  let left = trigger.left + trigger.width / 2 - tooltip.width / 2;

  if (actualSide === "bottom") top = trigger.bottom + OFFSET;
  if (actualSide === "top") top = trigger.top - tooltip.height - OFFSET;
  if (actualSide === "right") left = trigger.right + OFFSET;
  if (actualSide === "left") left = trigger.left - tooltip.width - OFFSET;

  if (actualSide === "bottom" || actualSide === "top") {
    left = trigger.left + trigger.width / 2 - tooltip.width / 2;
  } else {
    top = trigger.top + trigger.height / 2 - tooltip.height / 2;
  }

  return {
    position: "fixed",
    top: clamp(top, VIEWPORT_GAP, Math.max(VIEWPORT_GAP, vh - tooltip.height - VIEWPORT_GAP)),
    left: clamp(left, VIEWPORT_GAP, Math.max(VIEWPORT_GAP, vw - tooltip.width - VIEWPORT_GAP)),
  };
}

/**
 * Lightweight hover/focus tooltip (no Radix dependency). Wrap any control.
 */
export function Tooltip({ content, shortcut, side = "top", children, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const update = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;
      setPosition(measurePosition(trigger.getBoundingClientRect(), tooltip.getBoundingClientRect(), side));
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, side]);

  return (
    <span
      ref={triggerRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {children}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.span
              ref={tooltipRef}
              role="tooltip"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              style={position ?? { position: "fixed", top: 0, left: 0, visibility: "hidden" }}
              className="pointer-events-none z-[9999] flex max-w-[calc(100vw-16px)] items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface-3 px-2 py-1 text-xs text-fg shadow-lg"
            >
              {content}
              {shortcut && (
                <kbd className="rounded border border-border-soft bg-surface-2 px-1 text-[10px] font-medium text-muted">
                  {shortcut}
                </kbd>
              )}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
}
