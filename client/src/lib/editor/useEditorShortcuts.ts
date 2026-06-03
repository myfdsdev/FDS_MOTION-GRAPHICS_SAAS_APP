import { useEffect } from "react";

export interface EditorShortcutHandlers {
  undo: () => void;
  redo: () => void;
  split: () => void;
  duplicate: () => void;
  remove: () => void;
  togglePlay?: () => void;
  toggleSnap?: () => void;
  /** Step the playhead by N frames (positive = forward, negative = back). */
  stepFrame?: (frames: number) => void;
  /** Jump the playhead to the very start (0). */
  jumpToStart?: () => void;
  /** Jump the playhead to the end of the timeline. */
  jumpToEnd?: () => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

/**
 * Global keyboard shortcuts for the editor. No-ops while typing in a field.
 *   ⌘/Ctrl+Z undo · ⌘/Ctrl+Shift+Z (or Ctrl+Y) redo
 *   S split · ⌘/Ctrl+D duplicate · Delete/Backspace remove
 *   Space play/pause · N toggle snapping
 */
export function useEditorShortcuts(handlers: EditorShortcutHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handlers.redo();
        else handlers.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handlers.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handlers.duplicate();
        return;
      }
      if (!mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handlers.split();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handlers.remove();
        return;
      }
      if (e.key === " " && handlers.togglePlay) {
        e.preventDefault();
        handlers.togglePlay();
        return;
      }
      if (!mod && e.key.toLowerCase() === "n" && handlers.toggleSnap) {
        e.preventDefault();
        handlers.toggleSnap();
        return;
      }

      // Frame-step navigation — Adobe / Premiere / FCP convention:
      //   ← / →            step 1 frame
      //   Shift+← / Shift+→ step 10 frames
      //   Home / End       jump to start / end
      //   , / .            also 1-frame step (DaVinci convention)
      if (handlers.stepFrame && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        handlers.stepFrame(dir * (e.shiftKey ? 10 : 1));
        return;
      }
      if (handlers.stepFrame && (e.key === "," || e.key === ".")) {
        e.preventDefault();
        handlers.stepFrame(e.key === "." ? 1 : -1);
        return;
      }
      if (e.key === "Home" && handlers.jumpToStart) {
        e.preventDefault();
        handlers.jumpToStart();
        return;
      }
      if (e.key === "End" && handlers.jumpToEnd) {
        e.preventDefault();
        handlers.jumpToEnd();
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}
