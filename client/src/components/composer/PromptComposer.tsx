import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TextareaAutosize from "react-textarea-autosize";
import {
  Clock,
  Monitor,
  Image as ImageIcon,
  FileText,
  Clapperboard,
  Palette,
  ListOrdered,
  Mic,
  Music,
  Zap,
  Sparkles,
  Wand2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreateProject, useEnhancePrompt } from "@/lib/queries";
import { toast } from "sonner";

const DURATIONS = [
  { label: "15s", value: 15 },
  { label: "20s", value: 20 },
  { label: "30s", value: 30 },
];

const RATIOS = [
  { label: "16:9", value: "16:9" as const, desc: "Landscape" },
  { label: "9:16", value: "9:16" as const, desc: "Portrait" },
  { label: "1:1", value: "1:1" as const, desc: "Square" },
];

const STYLES = [
  "Cinematic",
  "Minimal",
  "Bold typography",
  "Retro",
  "Tech / Futuristic",
  "Playful",
];

const MODELS = [
  { name: "Miltos 5.0", desc: "Best quality, balanced", beta: true },
  { name: "Miltos 4.0", desc: "Faster, less detailed" },
  { name: "Miltos Fast", desc: "Lowest cost" },
];

interface Chip {
  type: "duration" | "ratio" | "style" | "feature";
  value: string;
}

export function PromptComposer({ requireAuth = false }: { requireAuth?: boolean }) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const enhance = useEnhancePrompt();

  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(15);
  const [ratio, setRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [style, setStyle] = useState<string | null>(null);
  const [model, setModel] = useState(MODELS[0]);
  const [activeFeatures, setActiveFeatures] = useState<Set<string>>(new Set());

  const toggleFeature = (f: string) =>
    setActiveFeatures((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });

  const handleEnhance = async () => {
    if (prompt.trim().length < 5) {
      toast.error("Write a bit more first, then I can enhance it.");
      return;
    }
    try {
      const better = await enhance.mutateAsync(prompt);
      setPrompt(better);
      toast.success("Prompt enhanced");
    } catch (e) {
      toast.error("Couldn't enhance the prompt");
    }
  };

  const handleCreate = async () => {
    if (prompt.trim().length < 10) {
      toast.error("Tell us what video to create — at least a sentence.");
      return;
    }
    try {
      const proj = await createProject.mutateAsync({ prompt, durationSec: duration });
      navigate(`/projects/${proj.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create";
      if (msg.includes("Not authenticated") || requireAuth) {
        toast.error("Please sign in first");
        navigate("/login");
      } else {
        toast.error(msg);
      }
    }
  };

  const isSubmitting = createProject.isPending;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-card">
        {/* Row 1: format chips */}
        <div className="flex flex-wrap gap-2 mb-2.5">
          {/* Duration */}
          <Popover>
            <PopoverTrigger asChild>
              <ChipButton>
                <Clock size={14} />
                {duration}s
              </ChipButton>
            </PopoverTrigger>
            <PopoverContent className="w-40">
              <div className="text-xs text-muted px-2 py-1.5">Duration</div>
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-surface-2",
                    duration === d.value && "bg-surface-2 text-accent-soft"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Aspect ratio */}
          <Popover>
            <PopoverTrigger asChild>
              <ChipButton>
                <Monitor size={14} />
                {ratio}
              </ChipButton>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="text-xs text-muted px-2 py-1.5">Aspect ratio</div>
              {RATIOS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRatio(r.value)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md hover:bg-surface-2 flex items-center justify-between",
                    ratio === r.value && "bg-surface-2"
                  )}
                >
                  <span className="text-sm">{r.label}</span>
                  <span className="text-xs text-muted">{r.desc}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <ChipButton
            active={activeFeatures.has("images")}
            onClick={() => toggleFeature("images")}
          >
            <ImageIcon size={14} />
            Images
          </ChipButton>

          <ChipButton
            active={activeFeatures.has("docs")}
            onClick={() => toggleFeature("docs")}
          >
            <FileText size={14} />
            Docs
          </ChipButton>

          {/* Style */}
          <Popover>
            <PopoverTrigger asChild>
              <ChipButton active={!!style}>
                <Clapperboard size={14} />
                {style ?? "Style"}
              </ChipButton>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="text-xs text-muted px-2 py-1.5">Visual style</div>
              {STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(style === s ? null : s)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-surface-2",
                    style === s && "bg-surface-2 text-accent-soft"
                  )}
                >
                  {s}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <ChipButton aria-label="Color palette" iconOnly>
            <Palette size={14} />
          </ChipButton>
        </div>

        {/* Row 2: pipeline chips */}
        <div className="flex flex-wrap gap-2 mb-1">
          <ChipButton
            active={activeFeatures.has("plan")}
            onClick={() => toggleFeature("plan")}
          >
            <ListOrdered size={14} />
            Plan
          </ChipButton>

          <div className="flex items-center bg-surface-2 border border-border rounded-full hover:bg-surface-3 transition-colors">
            <button
              onClick={() => toggleFeature("narration")}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium"
            >
              <Mic size={14} />
              Narration
            </button>
            <div className="w-px h-4 bg-border" />
            <button className="px-2 py-2 text-muted hover:text-fg">
              <ChevronDown size={12} />
            </button>
          </div>

          <ChipButton
            active={activeFeatures.has("music")}
            onClick={() => toggleFeature("music")}
          >
            <Music size={14} />
            Music
          </ChipButton>

          <ChipButton
            active={activeFeatures.has("sfx")}
            onClick={() => toggleFeature("sfx")}
          >
            <Zap size={14} fill="currentColor" />
            SFX
          </ChipButton>
        </div>

        {/* Prompt textarea */}
        <TextareaAutosize
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A logo reveal for a SaaS launch, energetic music, modern motion graphics…"
          minRows={3}
          maxRows={10}
          className="w-full bg-transparent border-0 outline-none text-fg placeholder:text-faint px-1.5 py-3.5 text-sm resize-none scrollbar-thin"
        />

        {/* Action row */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border rounded-full text-xs font-medium hover:bg-surface-3 transition-colors">
                <Sparkles size={13} className="text-accent" />
                {model.name}
                {model.beta && (
                  <span className="px-1.5 py-px bg-accent/20 text-accent-soft rounded text-[10px] font-bold tracking-wider">
                    BETA
                  </span>
                )}
                <ChevronDown size={12} className="opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="text-xs text-muted px-2 py-1.5">Model</div>
              {MODELS.map((m) => (
                <button
                  key={m.name}
                  onClick={() => setModel(m)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md hover:bg-surface-2",
                    model.name === m.name && "bg-surface-2"
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {m.name}
                    {m.beta && (
                      <span className="px-1.5 py-px bg-accent/20 text-accent-soft rounded text-[10px] font-bold tracking-wider">
                        BETA
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-0.5">{m.desc}</div>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <button
            onClick={handleEnhance}
            disabled={enhance.isPending}
            className="w-9 h-9 bg-surface-2 border border-border rounded-full flex items-center justify-center text-muted hover:text-fg hover:bg-surface-3 transition-colors disabled:opacity-50"
            aria-label="Enhance prompt"
            title="Enhance prompt"
          >
            <Wand2 size={15} className={enhance.isPending ? "animate-pulse" : ""} />
          </button>

          <button
            onClick={handleCreate}
            disabled={prompt.trim().length < 10 || isSubmitting}
            className="bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-fg px-5 py-2.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all shadow-accent active:translate-y-px"
          >
            {isSubmitting ? "Creating…" : "Create New Video"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Chip subcomponent ----------

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  iconOnly?: boolean;
}

function ChipButton({ active, iconOnly, className, children, ...props }: ChipProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center gap-1.5 bg-surface-2 border border-border rounded-full text-xs font-medium transition-all hover:bg-surface-3 active:translate-y-px",
        iconOnly ? "w-8 h-8 justify-center" : "px-3.5 py-2",
        active && "bg-surface-3 border-accent/40 text-accent-soft",
        className
      )}
    >
      {children}
    </button>
  );
}
