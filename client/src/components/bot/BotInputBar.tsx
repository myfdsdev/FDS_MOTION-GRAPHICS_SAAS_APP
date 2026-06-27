import { useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowUp } from "lucide-react";

export function BotInputBar({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");

  const send = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };

  return (
    <div className="bg-surface border border-border rounded-2xl px-3 py-2 flex items-end gap-2 focus-within:border-neutral-600 transition-colors">
      <TextareaAutosize
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        minRows={1}
        maxRows={8}
        autoFocus
        placeholder="Message Mosaic — ask anything, or say “make a video about…”"
        className="flex-1 bg-transparent outline-none resize-none text-fg placeholder:text-faint py-1.5 text-[15px] scrollbar-thin"
      />
      <button
        type="button"
        onClick={send}
        disabled={disabled || !text.trim()}
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-accent text-accent-ink disabled:opacity-40 hover:bg-accent-hover transition-colors active:translate-y-px"
        aria-label="Send"
      >
        <ArrowUp size={17} />
      </button>
    </div>
  );
}
