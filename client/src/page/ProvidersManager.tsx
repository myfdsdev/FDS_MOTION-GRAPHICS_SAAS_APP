import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Brain, ImageIcon, Loader2, Mic, Music, Video } from "lucide-react";
import { toast } from "sonner";
import {
  useProviderKeys,
  useProvidersConfig,
  useSaveProviderKeys,
  useSaveProvidersConfig,
} from "@/lib/queries";
import type { ProviderKeySummary } from "@/lib/api";

/* ------------------------------------------------------------------ *
 * Category-tabbed provider manager. Keys persist via /admin/provider-keys;
 * per-model enable flags via /admin/providers-config. The catalog below is
 * reference data (names, models, capabilities); live key status is merged in.
 * ------------------------------------------------------------------ */

type Category = "llm" | "video" | "image" | "music" | "voice";
type Cap = "t2v" | "i2v" | "v2v" | "t2i" | "i2i";

interface ModelDef {
  name: string;
  caps?: Cap[];
}
interface ProviderDef {
  id: string; // matches backend provider-keys id (or noKey providers)
  name: string;
  desc: string;
  brand: string;
  noKey?: boolean;
  models: ModelDef[];
}

const CATEGORY_META: Record<
  Category,
  { label: string; icon: typeof Brain; title: string; blurb: string; caps?: Cap[] }
> = {
  llm: { label: "LLM", icon: Brain, title: "Language models", blurb: "Write scripts, scene plans, and prompts." },
  video: { label: "Video", icon: Video, title: "Video generation", blurb: "Turn text or images into AI footage.", caps: ["t2v", "i2v", "v2v"] },
  image: { label: "Image", icon: ImageIcon, title: "Image generation", blurb: "Stills for backgrounds and image-to-video.", caps: ["t2i", "i2i"] },
  music: { label: "Music", icon: Music, title: "Music generation", blurb: "Soundtrack beds for your videos." },
  voice: { label: "Voice", icon: Mic, title: "Voice / narration", blurb: "Text-to-speech narration." },
};

const CATALOG: Record<Category, ProviderDef[]> = {
  llm: [
    { id: "anthropic", name: "Anthropic", brand: "#d97757", desc: "Claude — best for scripts & scene plans.", models: [{ name: "claude-opus-4-8" }, { name: "claude-sonnet-4-6" }] },
    { id: "openai", name: "OpenAI", brand: "#10a37f", desc: "GPT models for planning and copy.", models: [{ name: "gpt-4o" }, { name: "gpt-4o-mini" }] },
    { id: "openrouter", name: "OpenRouter", brand: "#6467f2", desc: "One key, many models (incl. free tiers).", models: [{ name: "anthropic/claude-sonnet-4" }] },
    { id: "gemini", name: "Google Gemini", brand: "#4285f4", desc: "Fast, cheap planning model.", models: [{ name: "gemini-2.5-flash" }, { name: "gemini-2.0-flash" }] },
  ],
  video: [
    { id: "runway", name: "Runway", brand: "#a78bfa", desc: "Gen-4 cinematic image→video.", models: [{ name: "gen4_turbo", caps: ["i2v", "t2v"] }, { name: "gen4_aleph", caps: ["v2v"] }] },
    { id: "kie", name: "kie.ai", brand: "#22d3ee", desc: "Grok / Kling video via one key.", models: [{ name: "grok-imagine/image-to-video", caps: ["i2v"] }, { name: "kling-2.6/text-to-video", caps: ["t2v"] }] },
    { id: "fal", name: "fal.ai", brand: "#ff5c8a", desc: "Kling / LTX / MiniMax video.", models: [{ name: "kling-video", caps: ["i2v", "t2v"] }, { name: "ltx-video", caps: ["t2v"] }] },
  ],
  image: [
    { id: "fal", name: "fal.ai", brand: "#ff5c8a", desc: "FLUX image models.", models: [{ name: "flux/dev", caps: ["t2i", "i2i"] }, { name: "flux/schnell", caps: ["t2i"] }] },
    { id: "runway", name: "Runway", brand: "#a78bfa", desc: "Gen-4 stills.", models: [{ name: "gen4_image", caps: ["t2i", "i2i"] }] },
    { id: "kie", name: "kie.ai", brand: "#22d3ee", desc: "GPT-image / Nano Banana.", models: [{ name: "nano-banana-pro", caps: ["t2i"] }] },
  ],
  music: [
    { id: "fal", name: "fal.ai", brand: "#ff5c8a", desc: "ElevenLabs music models.", models: [{ name: "elevenlabs/music" }] },
    { id: "kie", name: "kie.ai (Suno)", brand: "#22d3ee", desc: "Suno full-song generation.", models: [{ name: "suno-v4" }] },
  ],
  voice: [
    { id: "elevenlabs", name: "ElevenLabs", brand: "#34d399", desc: "High-quality TTS voices.", models: [{ name: "eleven_multilingual_v2" }] },
    { id: "system", name: "System (SAPI)", brand: "#9ca3af", noKey: true, desc: "Built-in Windows voices — free, no key.", models: [{ name: "David" }, { name: "Zira" }] },
  ],
};

const CATEGORIES = Object.keys(CATEGORY_META) as Category[];
function isCategory(v: string | null): v is Category {
  return v != null && (CATEGORIES as string[]).includes(v);
}

export default function ProvidersManager({ isAdmin }: { isAdmin: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const catParam = searchParams.get("cat");
  const activeCategory: Category = isCategory(catParam) ? catParam : "llm";

  const { data: keys = [] } = useProviderKeys(isAdmin);
  const { data: config } = useProvidersConfig(isAdmin);
  const saveKeys = useSaveProviderKeys();
  const saveConfig = useSaveProvidersConfig();

  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [pendingToggles, setPendingToggles] = useState<Record<string, boolean>>({});
  // Custom model per provider+category (free text → "put any model"). Key: `${provider}:${category}`.
  const [modelDrafts, setModelDrafts] = useState<Record<string, string>>({});

  const keyById = useMemo(() => {
    const m: Record<string, ProviderKeySummary> = {};
    for (const k of keys) m[k.id] = k;
    return m;
  }, [keys]);

  const setCategory = (cat: Category) => {
    const next = new URLSearchParams(searchParams);
    next.set("cat", cat);
    setSearchParams(next, { replace: true });
  };

  const isEnabled = (provider: string, model: string) => {
    const k = `${provider}:${model}`;
    if (k in pendingToggles) return pendingToggles[k];
    const stored = config?.enabledModels?.[k];
    return stored === undefined ? true : stored;
  };

  const toggleModel = (provider: string, model: string) => {
    const k = `${provider}:${model}`;
    setPendingToggles((p) => ({ ...p, [k]: !isEnabled(provider, model) }));
  };

  const modelKey = (provider: string) => `${provider}:${activeCategory}`;
  const customModelValue = (provider: string) => {
    const k = modelKey(provider);
    if (k in modelDrafts) return modelDrafts[k];
    return config?.customModels?.[k] ?? "";
  };
  const editedModelKeys = Object.keys(modelDrafts).filter(
    (k) => (modelDrafts[k] ?? "") !== (config?.customModels?.[k] ?? "")
  );

  const saveOneKey = async (providerId: string) => {
    const v = (keyDrafts[providerId] ?? "").trim();
    if (!v) return;
    try {
      await saveKeys.mutateAsync({ [providerId]: v });
      setKeyDrafts((d) => ({ ...d, [providerId]: "" }));
      toast.success("Key saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save key");
    }
  };

  const saveAll = async () => {
    const keyPatch: Record<string, string> = {};
    for (const [id, v] of Object.entries(keyDrafts)) if (v.trim()) keyPatch[id] = v.trim();
    const modelPatch: Record<string, string> = {};
    for (const k of editedModelKeys) modelPatch[k] = (modelDrafts[k] ?? "").trim();
    try {
      if (Object.keys(keyPatch).length) await saveKeys.mutateAsync(keyPatch);
      if (Object.keys(pendingToggles).length || Object.keys(modelPatch).length) {
        await saveConfig.mutateAsync({ enabledModels: pendingToggles, customModels: modelPatch });
      }
      setKeyDrafts({});
      setPendingToggles({});
      setModelDrafts({});
      toast.success("Provider config saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  };

  const dirty =
    Object.values(keyDrafts).some((v) => v.trim()) ||
    Object.keys(pendingToggles).length > 0 ||
    editedModelKeys.length > 0;
  const providers = CATALOG[activeCategory];
  const meta = CATEGORY_META[activeCategory];

  return (
    <section className="rounded-[14px] border border-white/[0.07] bg-surface p-[18px]">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Providers</h2>
        <button
          type="button"
          onClick={saveAll}
          disabled={!dirty || saveKeys.isPending || saveConfig.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-[#8b5cf6] to-[#a78bfa] px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saveKeys.isPending || saveConfig.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
          Save all
        </button>
      </div>

      {/* Tab bar */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {CATEGORIES.map((cat) => {
          const M = CATEGORY_META[cat];
          const Icon = M.icon;
          const active = cat === activeCategory;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-gradient-to-r from-[#8b5cf6] to-[#a78bfa] text-white"
                  : "bg-surface-2 text-muted hover:text-fg"
              }`}
            >
              <Icon size={15} />
              {M.label}
              <span
                className={`rounded-full px-1.5 text-xs ${
                  active ? "bg-white/20 text-white" : "bg-white/[0.06] text-faint"
                }`}
              >
                {CATALOG[cat].length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Category intro */}
      <div className="mt-4">
        <h3 className="text-base font-semibold">{meta.title}</h3>
        <p className="mt-0.5 text-sm text-muted">{meta.blurb}</p>
      </div>

      {/* Provider cards */}
      <div className="mt-4 grid gap-[18px] lg:grid-cols-2">
        {providers.map((p) => (
          <ProviderCard
            key={`${activeCategory}-${p.id}`}
            provider={p}
            categoryCaps={meta.caps}
            keyInfo={keyById[p.id]}
            draft={keyDrafts[p.id] ?? ""}
            onDraft={(v) => setKeyDrafts((d) => ({ ...d, [p.id]: v }))}
            onSaveKey={() => saveOneKey(p.id)}
            saving={saveKeys.isPending}
            isEnabled={(m) => isEnabled(p.id, m)}
            onToggle={(m) => toggleModel(p.id, m)}
            modelValue={customModelValue(p.id)}
            modelPlaceholder={p.models[0]?.name ?? "model name"}
            onModel={(v) => setModelDrafts((d) => ({ ...d, [modelKey(p.id)]: v }))}
          />
        ))}
      </div>
    </section>
  );
}

function StatusPill({ keyInfo, noKey }: { keyInfo?: ProviderKeySummary; noKey?: boolean }) {
  if (noKey) {
    return <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">built-in</span>;
  }
  const source = keyInfo?.source;
  const last4 = keyInfo?.last4;
  if (source === "env") {
    return <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">env ····{last4}</span>;
  }
  if (source === "db") {
    return <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent-soft">user key ····{last4}</span>;
  }
  return <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">not set</span>;
}

function ProviderCard({
  provider,
  categoryCaps,
  keyInfo,
  draft,
  onDraft,
  onSaveKey,
  saving,
  isEnabled,
  onToggle,
  modelValue,
  modelPlaceholder,
  onModel,
}: {
  provider: ProviderDef;
  categoryCaps?: Cap[];
  keyInfo?: ProviderKeySummary;
  draft: string;
  onDraft: (v: string) => void;
  onSaveKey: () => void;
  saving: boolean;
  isEnabled: (model: string) => boolean;
  onToggle: (model: string) => void;
  modelValue: string;
  modelPlaceholder: string;
  onModel: (v: string) => void;
}) {
  const configured = provider.noKey || Boolean(keyInfo?.configured);
  return (
    <div className="flex flex-col rounded-[12px] border border-white/[0.07] bg-surface-2/40 p-4">
      {/* header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ background: provider.brand }}
        >
          {provider.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{provider.name}</p>
        </div>
        <StatusPill keyInfo={keyInfo} noKey={provider.noKey} />
      </div>

      <p className="mt-2 text-xs text-muted">{provider.desc}</p>

      {/* key row */}
      {!provider.noKey ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="password"
            autoComplete="off"
            placeholder={configured ? "Replace key…" : "Paste key…"}
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={onSaveKey}
            disabled={saving || !draft.trim()}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      ) : null}

      {/* custom model — type ANY model name (e.g. nano-banana-pro) */}
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[11px] font-medium text-faint">Model</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={modelPlaceholder}
          value={modelValue}
          onChange={(e) => onModel(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-xs outline-none focus:border-accent"
        />
      </div>

      {/* models */}
      <div className="mt-3 space-y-1.5">
        {provider.models.map((m) => {
          const on = isEnabled(m.name);
          return (
            <div key={m.name} className="flex items-center gap-2 rounded-md bg-surface/60 px-2.5 py-1.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? "bg-success" : "bg-faint"}`} />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{m.name}</span>

              {categoryCaps ? (
                <div className="flex shrink-0 gap-1">
                  {categoryCaps.map((cap) => {
                    const supported = m.caps?.includes(cap);
                    return (
                      <span
                        key={cap}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                          supported
                            ? "bg-accent/15 text-accent-soft"
                            : "bg-white/[0.04] text-faint"
                        }`}
                      >
                        {cap}
                      </span>
                    );
                  })}
                </div>
              ) : null}

              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Toggle ${m.name}`}
                onClick={() => onToggle(m.name)}
                className="relative h-5 w-9 shrink-0 rounded-full border border-border bg-surface-2 p-0.5 transition-colors aria-checked:border-transparent aria-checked:bg-accent"
              >
                <span
                  className={`block h-3.5 w-3.5 rounded-full bg-fg shadow transition-transform ${
                    on ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
