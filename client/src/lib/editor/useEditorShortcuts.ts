import { useEffect } from "react";

export interface EditorShortcutHandlers {
  undo: () => void;
  redo: () => void;
  split: () => void;
  duplicate: () => void;
  remove: () => void;
  togglePlay?: () => void;
  toggleSnap?: () => void;
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
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}
