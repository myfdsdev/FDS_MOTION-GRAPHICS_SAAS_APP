import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TextareaAutosize from "react-textarea-autosize";
import {
  Sparkles, Plus, Mic, MicOff, AudioLines, Wand2, X, ImageIcon,
  Clock, Monitor, Smartphone, Tablet, Square, Music2, VolumeX, Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreateProject, useEnhancePrompt, useRecipes } from "@/lib/queries";
import { isVideoAssistantTopic, VIDEO_ASSISTANT_SCOPE_MESSAGE } from "@/lib/domainGuard";
import type { AspectRatio } from "@/types";
import TextType from "@/components/reactbits/TextType";
import { toast } from "sonner";

interface Props {
  /** Big centered greeting shown above the box, e.g. "Back at it, Deepanker". */
  greeting?: string;
  /** Called with picked files when the "+" button is used (optional). */
  onPickFiles?: (files: File[]) => void;
  /** Default video length in seconds. */
  durationSec?: number;
  /** Which template section this page is for: "ai-video" (footage) or
   *  "motion-graphics" (no footage). Locks the picker to that group. */
  section?: "ai-video" | "motion-graphics";
  /** Show the template picker cards. When false, just the prompt + generate. */
  showTemplates?: boolean;
  /** Force a specific recipe (overrides the picker). e.g. "none" = AI writes
   *  the whole video as custom TSX code. */
  forcedRecipe?: string;
}

const PROMPT_GUIDANCE =
  "Tell me what kind of video you want to make, paste a script, or attach a reference image.";

const DURATIONS = [10, 20, 30, 40, 50, 60];
const FORMATS: { label: string; ratio: AspectRatio; Icon: LucideIcon }[] = [
  { label: "Desktop", ratio: "16:9", Icon: Monitor },
  { label: "Mobile", ratio: "9:16", Icon: Smartphone },
  { label: "Tablet", ratio: "4:3", Icon: Tablet },
  { label: "Square", ratio: "1:1", Icon: Square },
];
const GREETING_RE = /^(hi|hello|hey|yo|helo|hlow|good morning|good afternoon|good evening|good night|gm)\b/i;
const CHAT_ONLY_RE =
  /\b(prompt|idea|suggest|example|how|why|what|fix|error|bug|problem|debug|setup|install|not working|failed|crash)\b|\b(create|write)\s+(a\s+)?script\b/i;

function isGreeting(input: string) {
  return GREETING_RE.test(input.trim());
}

function shouldGenerateFromEnter(input: string) {
  // Topic guard removed — Enter generates for any real prompt (still ignore
  // bare greetings so "hi" doesn't kick off a render).
  const text = input.trim();
  return text.length >= 10 && !isGreeting(text);
}

export function CleanComposer({ greeting, onPickFiles, durationSec: defaultDurationSec = 20, section = "ai-video", showTemplates = true, forcedRecipe }: Props) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const enhance = useEnhancePrompt();
  const { data: recipes } = useRecipes();
  const fileInput = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState("");
  const [recipe, setRecipe] = useState("");
  const [durationSec, setDurationSec] = useState(defaultDurationSec);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [narration, setNarration] = useState(true);
  const [music, setMusic] = useState(true);
  const [images, setImages] = useState<string[]>([]); // data URLs that become the video

  // This page is locked to one section; show only its templates and keep the
  // chosen recipe inside it.
  const sectionRecipes = (recipes ?? []).filter((r) => (r.group ?? "ai-video") === section);
  useEffect(() => {
    // Only auto-select a template when the picker is shown. When hidden, leave
    // recipe blank so the backend auto-picks from the prompt.
    if (showTemplates && sectionRecipes.length && !sectionRecipes.some((r) => r.id === recipe)) {
      setRecipe(sectionRecipes[0].id);
    }
  }, [showTemplates, sectionRecipes, recipe]);

  const isSubmitting = createProject.isPending;
  const canSubmit = (prompt.trim().length >= 10 || images.length > 0) && !isSubmitting;

  const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const valid = picked.filter((f) => {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name}: only image files are supported`);
        return false;
      }
      if (f.size > 4 * 1024 * 1024) {
        toast.error(`${f.name}: must be under 4 MB`);
        return false;
      }
      return true;
    });
    if (!valid.length) return;
    const room = Math.max(0, 5 - images.length);
    if (room === 0) {
      toast.error("Up to 5 images");
      return;
    }
    const urls = await Promise.all(valid.slice(0, room).map(readAsDataUrl));
    setImages((prev) => [...prev, ...urls]);
    if (onPickFiles) onPickFiles(valid);
  };

  const handleCreate = async () => {
    // With images, a short/blank prompt is fine — the AI writes the script from
    // the images. Otherwise require a sentence.
    if (prompt.trim().length < 10 && images.length === 0) {
      toast.error("Tell us what video to create — or drop a few images.");
      return;
    }
    const finalPrompt =
      prompt.trim().length >= 10
        ? prompt
        : "A short cinematic video made from these images.";
    try {
      const proj = await createProject.mutateAsync({
        prompt: finalPrompt,
        durationSec,
        aspectRatio,
        recipe: forcedRecipe ?? recipe,
        narration,
        music,
        images: images.length ? images : undefined,
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
    if (!isVideoAssistantTopic(prompt)) {
      toast.message(VIDEO_ASSISTANT_SCOPE_MESSAGE);
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

  const handlePromptSubmit = () => {
    const message = prompt.trim();
    if (message.length < 2) {
      toast.message(PROMPT_GUIDANCE);
      return;
    }

    if (isGreeting(message)) {
      setPrompt("");
      toast.message(PROMPT_GUIDANCE);
      return;
    }

    if (!isVideoAssistantTopic(message)) {
      toast.message(VIDEO_ASSISTANT_SCOPE_MESSAGE);
      return;
    }

    if (shouldGenerateFromEnter(message)) {
      void handleCreate();
      return;
    }

    toast.message(PROMPT_GUIDANCE);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isSubmitting) return;
      handlePromptSubmit();
    }
  };

  const fmt = FORMATS.find((x) => x.ratio === aspectRatio) ?? FORMATS[0];
  const FmtIcon = fmt.Icon;

  return (
    <div className="w-full max-w-3xl mx-auto">
      {greeting && (
        <div className="flex items-center justify-center gap-3 mb-8">
          <Sparkles size={26} className="text-accent shrink-0" />
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-fg">
            {greeting}
          </h1>
        </div>
      )}

      {/* Prompt card */}
      <div className="bg-surface border border-border rounded-3xl p-3 sm:p-4 shadow-card transition-all focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/15">
        <div className="relative">
          {prompt === "" && (
            <TextType
              as="div"
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-2.5 text-[16px] leading-normal text-faint"
              text={[
                "Describe the video you want to create…",
                "Make a 30-second product demo",
                "Animate a chart of our revenue growth",
                "Create a YouTube intro for my channel",
                "Build an explainer on how solar panels work",
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
            minRows={3}
            maxRows={12}
            autoFocus
            className="relative w-full bg-transparent border-0 outline-none text-fg placeholder:text-faint px-2.5 py-2.5 text-[16px] leading-relaxed resize-none scrollbar-thin"
          />
        </div>

        {/* Uploaded images — these BECOME the video */}
        {images.length > 0 && (
          <div className="mb-2 rounded-2xl border border-border bg-surface-2/60 p-2">
            <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] text-faint">
              <ImageIcon size={12} className="text-accent shrink-0" />
              {images.length} image{images.length > 1 ? "s" : ""} — the AI will build the video from these
            </div>
            <div className="flex flex-wrap gap-2">
              {images.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} alt={`upload ${i + 1}`} className="h-16 w-16 rounded-lg object-cover border border-border" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-surface border border-border text-faint hover:text-danger"
                    aria-label="Remove image"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border-soft">
          {/* Left: settings */}
          <div className="flex items-center gap-1">
            <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={handleFilePick} />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-fg hover:bg-surface-2 transition-colors"
              title="Add images to build the video from (up to 5)"
            >
              <Plus size={18} />
            </button>

            {/* Length */}
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" title="Video length" className="h-8 px-2.5 rounded-lg inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg hover:bg-surface-2 transition-colors">
                  <Clock size={14} /> {durationSec}s
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-28 p-1">
                {DURATIONS.map((d) => (
                  <button key={d} type="button" onClick={() => setDurationSec(d)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-fg hover:bg-surface-2">
                    {d}s {durationSec === d && <Check size={13} className="text-accent" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Format */}
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" title="Aspect ratio" className="h-8 px-2.5 rounded-lg inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg hover:bg-surface-2 transition-colors">
                  <FmtIcon size={14} /> {fmt.ratio}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-44 p-1">
                {FORMATS.map((f) => {
                  const I = f.Icon;
                  return (
                    <button key={f.ratio} type="button" onClick={() => setAspectRatio(f.ratio)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-fg hover:bg-surface-2">
                      <I size={14} className="text-muted" /> {f.label}
                      <span className="ml-auto opacity-60">{f.ratio}</span>
                      {aspectRatio === f.ratio && <Check size={13} className="text-accent" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>

            <div className="mx-1 h-5 w-px bg-border-soft" />

            <button type="button" onClick={() => setNarration((v) => !v)} title={narration ? "Narration on" : "Narration off"}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-surface-2 ${narration ? "text-accent" : "text-faint hover:text-fg"}`}>
              {narration ? <Mic size={16} /> : <MicOff size={16} />}
            </button>
            <button type="button" onClick={() => setMusic((v) => !v)} title={music ? "Music on" : "Music off"}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-surface-2 ${music ? "text-accent" : "text-faint hover:text-fg"}`}>
              {music ? <Music2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button type="button" disabled title="Sound effects — coming soon"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-faint/40 cursor-not-allowed">
              <AudioLines size={16} />
            </button>
          </div>

          {/* Right: enhance + generate */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnhance}
              disabled={enhance.isPending}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-fg hover:bg-surface-2 transition-colors disabled:opacity-50"
              title="Enhance prompt with AI"
            >
              <Wand2 size={15} className={enhance.isPending ? "animate-pulse" : ""} />
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 h-9 pl-3.5 pr-4 rounded-full bg-accent text-accent-ink text-sm font-semibold hover:bg-accent-hover transition-colors shadow-accent active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 rounded-full border-2 border-accent-ink/40 border-t-accent-ink animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              {isSubmitting ? "Creating…" : "Generate"}
            </button>
          </div>
        </div>
      </div>

      {/* Template cards */}
      {showTemplates && sectionRecipes.length > 0 && (
        <div className="mt-7">
          <div className="mb-3 text-center text-[11px] uppercase tracking-[0.15em] text-faint">
            {section === "ai-video" ? "AI Video templates" : "Motion Graphics templates"}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {sectionRecipes.map((r) => {
              const active = recipe === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRecipe(r.id)}
                  className={`group text-left rounded-2xl border p-3.5 transition-all ${
                    active
                      ? "border-accent bg-accent/10 ring-1 ring-accent/30"
                      : "border-border bg-surface-2/40 hover:bg-surface-2 hover:border-neutral-600"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-medium ${active ? "text-fg" : "text-fg/90"}`}>{r.label}</span>
                    {active && <Check size={15} className="text-accent shrink-0" />}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-muted line-clamp-2">{r.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
