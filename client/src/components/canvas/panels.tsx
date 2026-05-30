import { useMemo, useState, type ComponentType } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CopyPlus,
  Image as ImageIcon,
  Search,
  Shapes,
  Sparkles,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { SceneElement, TimelineClip } from "@/types";
import type { EditorAction, ElementPatch } from "@/lib/editor/editorStore";
import { Tooltip } from "@/components/ui/Tooltip";

const FONTS = [
  "Inter",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
];

interface PanelCommon {
  clipId: string | null;
  dispatch: React.Dispatch<EditorAction>;
}

const ADD_ITEMS: { type: SceneElement["type"]; label: string; icon: typeof TypeIcon }[] = [
  { type: "text", label: "Text", icon: TypeIcon },
  { type: "icon", label: "Icon", icon: Sparkles },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "shape", label: "Shape", icon: Shapes },
];

export function ElementsPanel({ clipId, dispatch }: PanelCommon) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-soft px-4 py-3 text-sm font-semibold">Elements</div>
      <div className="grid grid-cols-2 gap-2 p-4">
        {ADD_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Tooltip key={item.type} content={`Add ${item.label.toLowerCase()}`}>
              <button
                disabled={!clipId}
                onClick={() => clipId && dispatch({ type: "ADD_ELEMENT", clipId, elementType: item.type })}
                className="flex w-full flex-col items-center gap-2 rounded-lg border border-border bg-surface-2/50 py-5 text-xs text-muted transition hover:border-accent/40 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon size={20} />
                {item.label}
              </button>
            </Tooltip>
          );
        })}
      </div>
      <p className="px-4 text-xs text-faint">New elements appear at the canvas center and are selected.</p>
    </div>
  );
}

interface PropertiesProps extends PanelCommon {
  elements: SceneElement[];
  selectedIds: string[];
  /** Single selected non-element clip (e.g. audio narration) — shown when no
   *  element is selected. */
  selectedClip?: TimelineClip | null;
}

export function PropertiesPanel({
  elements,
  selectedIds,
  clipId,
  dispatch,
  selectedClip,
}: PropertiesProps) {
  const selected = elements.filter((e) => selectedIds.includes(e.id));
  const el = selected[0] ?? null;

  // Audio clip selected (no element selection) — show audio-specific controls.
  if (!el && selectedClip && selectedClip.type === "audio") {
    const patchClip = (patch: Partial<TimelineClip>) =>
      dispatch({ type: "UPDATE_CLIP", clipId: selectedClip.id, patch });
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border-soft px-4 py-3 text-sm font-semibold">
          {selectedClip.label ?? "Audio"}
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <Section title="Audio">
            <NumField
              label="Volume (0–1)"
              value={Number((selectedClip.volume ?? 1).toFixed(2))}
              step={0.05}
              onChange={(v) => patchClip({ volume: Math.max(0, Math.min(1, v)) })}
            />
            <NumField
              label="Start (s)"
              value={Number(selectedClip.start.toFixed(2))}
              step={0.1}
              onChange={(v) => patchClip({ start: Math.max(0, v) })}
            />
            <NumField
              label="Duration (s)"
              value={Number(selectedClip.duration.toFixed(2))}
              step={0.1}
              onChange={(v) => patchClip({ duration: Math.max(0.1, v) })}
            />
            {selectedClip.src && (
              <p className="break-all text-[11px] text-faint">{selectedClip.src}</p>
            )}
          </Section>
        </div>
      </div>
    );
  }

  if (!el || !clipId) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border-soft px-4 py-3 text-sm font-semibold">Properties</div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted">
          Select an element on the canvas to edit it.
        </div>
      </div>
    );
  }

  const patch = (p: ElementPatch) =>
    dispatch({ type: "UPDATE_ELEMENT", clipId, elementId: el.id, patch: p });

  const duplicate = () => {
    const { id: _id, ...rest } = el;
    void _id;
    dispatch({
      type: "ADD_ELEMENT",
      clipId,
      elementType: el.type,
      element: { ...rest, x: Math.min(0.9, el.x + 0.03), y: Math.min(0.9, el.y + 0.03) },
    });
  };

  const pct = (v: number) => Math.round(v * 100);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
        <span className="text-sm font-semibold capitalize">{el.type}{selected.length > 1 ? ` ·${selected.length}` : ""}</span>
        <div className="flex items-center gap-1">
          <Tooltip content="Bring to front">
            <button onClick={() => dispatch({ type: "REORDER_Z", clipId, elementId: el.id, dir: "front" })} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg">
              <ArrowUpToLine size={14} />
            </button>
          </Tooltip>
          <Tooltip content="Send to back">
            <button onClick={() => dispatch({ type: "REORDER_Z", clipId, elementId: el.id, dir: "back" })} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg">
              <ArrowDownToLine size={14} />
            </button>
          </Tooltip>
          <Tooltip content="Duplicate" shortcut="⌘D">
            <button onClick={duplicate} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg">
              <CopyPlus size={14} />
            </button>
          </Tooltip>
          <Tooltip content="Delete" shortcut="⌫">
            <button onClick={() => dispatch({ type: "DELETE_ELEMENT", clipId })} className="rounded p-1 text-danger hover:bg-surface-2">
              <Trash2 size={14} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Position / size */}
        <Section title="Position & size">
          <div className="grid grid-cols-2 gap-2">
            <NumField label="X %" value={pct(el.x)} onChange={(v) => patch({ x: v / 100 })} />
            <NumField label="Y %" value={pct(el.y)} onChange={(v) => patch({ y: v / 100 })} />
            <NumField label="W %" value={pct(el.w)} onChange={(v) => patch({ w: v / 100 })} />
            <NumField label="H %" value={pct(el.h)} onChange={(v) => patch({ h: v / 100 })} />
            <NumField label="Rotation°" value={Math.round(el.rotation)} onChange={(v) => patch({ rotation: v })} />
            <NumField label="Z-index" value={el.z} onChange={(v) => patch({ z: Math.max(0, Math.round(v)) })} />
          </div>
        </Section>

        {el.type === "text" && (
          <Section title="Typography">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Text</span>
              <textarea
                rows={2}
                value={el.text}
                onChange={(e) => patch({ text: e.target.value })}
                className="w-full resize-none rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Size %h" value={Math.round((el.size ?? 0.08) * 100)} onChange={(v) => patch({ size: Math.max(0.5, v) / 100 })} />
              <NumField label="Weight" value={el.weight ?? 700} step={100} onChange={(v) => patch({ weight: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ColorField label="Color" value={el.color ?? "#ffffff"} onChange={(v) => patch({ color: v })} />
              <SelectField label="Align" value={el.align ?? "center"} options={["left", "center", "right"]} onChange={(v) => patch({ align: v as "left" | "center" | "right" })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SelectField label="Font" value={el.font ?? "Inter"} options={FONTS} onChange={(v) => patch({ font: v })} />
              <NumField label="Line height" value={el.lineHeight ?? 1.05} step={0.05} onChange={(v) => patch({ lineHeight: Math.max(0.5, v) })} />
            </div>
          </Section>
        )}

        {el.type === "icon" && (
          <Section title="Icon">
            <IconPicker value={el.name} onChange={(v) => patch({ name: v })} />
            <ColorField label="Color" value={el.color ?? "#ffffff"} onChange={(v) => patch({ color: v })} />
          </Section>
        )}

        {el.type === "image" && (
          <Section title="Image">
            <TextField label="Source URL" value={el.src} onChange={(v) => patch({ src: v })} />
            <SelectField label="Fit" value={el.fit ?? "cover"} options={["cover", "contain"]} onChange={(v) => patch({ fit: v as "cover" | "contain" })} />
          </Section>
        )}

        {el.type === "lottie" && (
          <Section title="Lottie">
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Speed" value={el.speed ?? 1} step={0.1} onChange={(v) => patch({ speed: Math.max(0.1, v) })} />
              <SelectField
                label="Loop"
                value={el.loop === false ? "no" : "yes"}
                options={["yes", "no"]}
                onChange={(v) => patch({ loop: v === "yes" })}
              />
            </div>
            {el.assetId && <p className="text-[11px] text-faint">Asset: {el.assetId}</p>}
          </Section>
        )}

        {el.type === "shape" && (
          <Section title="Shape">
            <SelectField label="Shape" value={el.shape} options={["rect", "ellipse"]} onChange={(v) => patch({ shape: v as "rect" | "ellipse" })} />
            <div className="grid grid-cols-2 gap-2">
              <ColorField label="Fill" value={el.fill ?? "#8b5cf6"} onChange={(v) => patch({ fill: v })} />
              <ColorField label="Stroke" value={el.stroke ?? "#000000"} onChange={(v) => patch({ stroke: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Stroke width" value={el.strokeWidth ?? 2} onChange={(v) => patch({ strokeWidth: Math.max(0, v) })} />
              {el.shape === "rect" && (
                <NumField label="Radius" value={el.radius ?? 8} onChange={(v) => patch({ radius: Math.max(0, v) })} />
              )}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

// Searchable lucide icon picker.
const ICON_LIB = LucideIcons as unknown as Record<string, ComponentType<{ size?: number }>>;
const ICON_NAMES = Object.keys(LucideIcons).filter(
  (k) => /^[A-Z][A-Za-z0-9]+$/.test(k) && !["Icon", "LucideProps"].includes(k)
);

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? ICON_NAMES.filter((n) => n.toLowerCase().includes(term)) : ICON_NAMES;
    return list.slice(0, 60);
  }, [q]);

  return (
    <div>
      <span className="mb-1 block text-xs text-muted">Icon ({value})</span>
      <div className="relative mb-1.5">
        <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search icons…"
          className="w-full rounded-lg border border-border bg-surface-2 py-1.5 pl-7 pr-2 text-sm text-fg outline-none focus:border-accent/50"
        />
      </div>
      <div className="grid max-h-40 grid-cols-6 gap-1 overflow-y-auto rounded-lg border border-border bg-surface-2/40 p-1.5">
        {results.map((name) => {
          const Ico = ICON_LIB[name];
          if (!Ico) return null;
          return (
            <button
              key={name}
              title={name}
              onClick={() => onChange(name)}
              className={`flex h-8 items-center justify-center rounded transition ${
                name === value ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              <Ico size={16} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-faint">{title}</p>
      {children}
    </div>
  );
}

function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
      />
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
      />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2 py-1">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-6 cursor-pointer rounded bg-transparent" />
        <span className="text-xs text-muted">{value}</span>
      </div>
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent/50"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
