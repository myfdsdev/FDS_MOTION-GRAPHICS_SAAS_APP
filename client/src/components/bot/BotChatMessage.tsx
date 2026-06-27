import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { BotMessage } from "@/types";

/**
 * Renders one chat bubble. Three kinds:
 *  - text  → markdown (assistant) / plain (user)
 *  - tool  → a running background-task card (e.g. "Generating video… 42%")
 *  - asset → a finished media result with an inline player + "Open" link
 */
export function BotChatMessage({ message }: { message: BotMessage }) {
  const isUser = message.role === "user";

  if (message.type === "tool") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[82%] rounded-2xl border border-border bg-surface-2/60 px-4 py-3">
          <div className="flex items-center gap-2.5 text-sm text-fg">
            <Loader2 size={15} className="animate-spin text-accent shrink-0" />
            <span>{message.content}</span>
          </div>
        </div>
      </div>
    );
  }

  if (message.type === "asset") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[82%] overflow-hidden rounded-2xl border border-border bg-surface-2/60">
          {message.outputUrl && (
            <video src={message.outputUrl} controls className="w-full max-w-md bg-black" />
          )}
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="truncate text-xs text-muted">{message.content}</span>
            {message.projectId && (
              <Link
                to={`/projects/${message.projectId}/edit`}
                className="shrink-0 text-xs font-medium text-accent hover:underline"
              >
                Open in editor →
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // text
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser ? "bg-accent text-accent-ink" : "bg-surface-2 text-fg"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <div className="leading-relaxed [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-accent [&_a]:underline [&_code]:rounded [&_code]:bg-black/30 [&_code]:px-1 [&_code]:py-0.5 [&_strong]:font-semibold">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
