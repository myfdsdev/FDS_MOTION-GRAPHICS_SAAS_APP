import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TextareaAutosize from "react-textarea-autosize";
import { Sparkles, Plus, Mic, AudioLines, ArrowUp, Wand2, X, ImageIcon } from "lucide-react";
import { useCreateProject, useEnhancePrompt } from "@/lib/queries";
import TextType from "@/components/reactbits/TextType";
import { toast } from "sonner";

interface Props {
  /** Big centered greeting shown above the box, e.g. "Back at it, Deepanker". */
  greeting?: string;
  /** Called with picked files when the "+" button is used (optional). */
  onPickFiles?: (files: File[]) => void;
  /** Default video length in seconds. */
  durationSec?: number;
}

export function CleanComposer({ greeting, onPickFiles, durationSec = 20 }: Props) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const enhance = useEnhancePrompt();
  const fileInput = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState("");
  const [refImage, setRefImage] = useState<string | null>(null);
  const [refName, setRefName] = useState("");

  const isSubmitting = createProject.isPending;
  const canSubmit = prompt.trim().length >= 10 && !isSubmitting;

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4 MB");
      return;
    }
    setRefName(file.name);
    const reader = new FileReader();
    reader.onload = () => setRefImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
    if (onPickFiles) onPickFiles([file]);
  };

  const handleCreate = async () => {
    if (prompt.trim().length < 10) {
      toast.error("Tell us what video to create — at least a sentence.");
      return;
    }
    try {
      const proj = await createProject.mutateAsync({
        prompt,
        durationSec,
        referenceImage: refImage ?? undefined,
      });
      navigate(`/projects/${proj.id}/edit`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create";
      if (msg.includes("Not authenticated")) {
        toast.error("Please sign in first");
        navigate("/login");
      } else {
        toast.error(msg);
      }
    }
  };

  const handleEnhance = async () => {
    if (prompt.trim().length < 5) {
      toast.error("Write a bit more first, then I can enhance it.");
      return;
    }
    try {
      const better = await enhance.mutateAsync(prompt);
      setPrompt(better);
      toast.success("Prompt enhanced");
    } catch {
      toast.error("Couldn't enhance the prompt");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) handleCreate();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {greeting && (
        <div className="flex items-center justify-center gap-3 mb-7">
          <Sparkles size={26} className="text-accent shrink-0" />
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-fg/90">
            {greeting}
          </h1>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl px-4 pt-3 pb-2.5 shadow-card focus-within:border-neutral-600 transition-colors">
        <div className="relative">
          {prompt === "" && (
            <TextType
              as="div"
              aria-hidden
              className="pointer-events-none absolute left-1.5 top-2 text-[15px] leading-normal text-faint"
              text={[
                "How can I help you today?",
                "Make a 30-second product demo",
                "Animate a chart of our revenue growth",
                "Create a YouTube intro for my channel",
                "Build an explainer video on how solar panels work",
              ]}
              typingSpeed={55}
              deletingSpeed={28}
              pauseDuration={1800}
              cursorCharacter="▋"
              cursorClassName="text-accent/70"
            />
          )}
          <TextareaAutosize
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            minRows={2}
            maxRows={12}
            autoFocus
            className="relative w-full bg-transparent border-0 outline-none text-fg placeholder:text-faint px-1.5 py-2 text-[15px] resize-none scrollbar-thin"
          />
        </div>

        {/* Reference image preview */}
        {refImage && (
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2/60 p-2 mb-1.5">
            <img src={refImage} alt="ref" className="h-14 w-14 rounded-lg object-cover border border-border" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-fg font-medium">
                <ImageIcon size={12} className="text-accent shrink-0" />
                <span className="truncate">{refName}</span>
              </div>
              <div className="text-[11px] text-faint mt-0.5">Design reference — layout, colors & style only (not content)</div>
            </div>
            <button
              type="button"
              onClick={() => { setRefImage(null); setRefName(""); }}
              className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-faint hover:text-danger hover:bg-surface-2 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Left: attach reference image */}
          <div className="flex items-center gap-1">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFilePick}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-fg hover:bg-surface-2 transition-colors"
              aria-label="Add reference image"
              title="Upload design reference (layout & style only)"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Right: enhance, model, mic, send */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleEnhance}
              disabled={enhance.isPending}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-fg hover:bg-surface-2 transition-colors disabled:opacity-50"
              aria-label="Enhance prompt"
              title="Enhance prompt"
            >
              <Wand2 size={15} className={enhance.isPending ? "animate-pulse" : ""} />
            </button>

            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-fg hover:bg-surface-2 transition-colors"
              aria-label="Voice input"
              title="Voice input"
            >
              <Mic size={16} />
            </button>

            {canSubmit ? (
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canSubmit}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-accent hover:bg-accent-hover text-accent-ink transition-colors shadow-accent active:translate-y-px"
                aria-label="Create video"
                title="Create video"
              >
                {isSubmitting ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <ArrowUp size={16} />
                )}
              </button>
            ) : (
              <button
                type="button"
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted"
                aria-label="Audio"
                title="Audio"
                disabled
              >
                <AudioLines size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-faint mt-3">
        Press Enter to generate · Shift+Enter for a new line
      </p>
    </div>
  );
}
