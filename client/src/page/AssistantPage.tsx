import { useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, Loader2, MessageSquare } from "lucide-react";
import * as api from "@/lib/api";
import {
  useBotSession,
  useBotSessions,
  useCreateBotSession,
  useSendBotMessage,
} from "@/lib/queries";
import { BotChatMessage } from "@/components/bot/BotChatMessage";
import { BotInputBar } from "@/components/bot/BotInputBar";
import type { BotSession } from "@/types";

const SUGGESTIONS = [
  "Make a 20s launch video for my app",
  "Create a kinetic typography quote video",
  "What templates can you make?",
];

export default function AssistantPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: session } = useBotSession(id);
  const { data: sessions } = useBotSessions();
  const createSession = useCreateBotSession();
  const send = useSendBotMessage(id);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [session?.messages?.length, session?.activeGeneration?.progress, send.isPending]);

  const busy = send.isPending || createSession.isPending;

  const handleSend = async (text: string) => {
    let sid = id;
    if (!sid) {
      const s = await createSession.mutateAsync();
      sid = s.id;
      navigate(`/assistant/${sid}`, { replace: true });
    }
    // Optimistic user bubble so it appears instantly.
    qc.setQueryData<BotSession>(["botSession", sid], (old) =>
      old
        ? { ...old, messages: [...old.messages, { id: `tmp-${Date.now()}`, role: "user", type: "text", content: text }] }
        : old
    );
    const updated = await api.sendBotMessage(sid, text);
    qc.setQueryData(["botSession", sid], updated);
    qc.invalidateQueries({ queryKey: ["botSessions"] });
  };

  const messages = session?.messages ?? [];

  return (
    <div className="flex h-screen">
      {/* Sessions rail */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border-soft p-3">
        <button
          onClick={() => navigate("/assistant")}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-fg hover:bg-surface-2 transition-colors"
        >
          <Plus size={15} /> New chat
        </button>
        <div className="mt-3 flex-1 space-y-0.5 overflow-y-auto scrollbar-thin">
          {(sessions ?? []).map((s) => (
            <Link
              key={s.id}
              to={`/assistant/${s.id}`}
              className={`flex items-center gap-2 truncate rounded-lg px-3 py-2 text-sm transition-colors ${
                s.id === id ? "bg-surface-2 text-fg" : "text-muted hover:text-fg hover:bg-surface-2/60"
              }`}
            >
              <MessageSquare size={14} className="shrink-0 opacity-70" />
              <span className="truncate">{s.title}</span>
            </Link>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <div className="flex flex-1 flex-col min-w-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-20 text-center">
                <Sparkles size={30} className="text-accent mb-3" />
                <h1 className="text-2xl font-semibold">Chat with Mosaic</h1>
                <p className="mt-1 text-sm text-muted">Ask anything, or just tell me what video to make.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-fg hover:bg-surface-2 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => <BotChatMessage key={m.id} message={m} />)
            )}

            {send.isPending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-muted">
                  <Loader2 size={15} className="inline animate-spin text-accent" /> Mosaic is thinking…
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border-soft p-4">
          <div className="mx-auto max-w-2xl">
            <BotInputBar onSend={handleSend} disabled={busy} />
            <p className="mt-2 text-center text-[11px] text-faint">
              Mosaic can make videos for you — they appear right here when ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
