import { useRef, useState } from "react";
import {
  ChevronsDown,
  ChevronsUp,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Lock,
  Shapes,
  Sparkles,
  Square,
  Trash2,
  Type as TypeIcon,
  Unlock,
  Captions,
  BarChart3,
  TrendingUp,
  Hash,
} from "lucide-react";
import type { SceneElement } from "@/types";
import type { EditorAction } from "@/lib/editor/editorStore";
import { Tooltip } from "@/components/ui/Tooltip";

const TYPE_ICON: Record<SceneElement["type"], typeof TypeIcon> = {
  text: TypeIcon,
  subtitle: Captions,
  "bar-chart": BarChart3,
  "line-chart": TrendingUp,
  stat: Hash,
  icon: Sparkles,
  image: ImageIcon,
  shape: Shapes,
  lottie: Square,
};

function elementLabel(el: SceneElement, index: number): string {
  if (el.name === "__headline__") return "Headline";
  if (el.name === "__subtext__") return "Subtext";
  if (el.name && el.name.trim()) return el.name;
  if (el.type === "text") return el.text?.slice(0, 36) || "Text";
  if (el.type === "subtitle") return el.text?.slice(0, 36) || "Subtitle";
  if (el.type === "bar-chart") return el.title || "Bar chart";
  if (el.type === "icon") return el.name && el.name.trim() ? el.name : "Icon";
  if (el.type === "image") return el.src ? "Image" : "Image (empty)";
  if (el.type === "shape") return el.shape === "ellipse" ? "Ellipse" : "Rectangle";
  if (el.type === "lottie") return "Lottie";
  return `Layer ${index + 1}`;
}

interface LayersPanelProps {
  clipId: string | null;
  elements: SceneElement[];
  selectedIds: string[];
  dispatch: React.Dispatch<EditorAction>;
}

/**
 * Adobe-style layers list. Top row = front (highest z). Click selects,
 * drag-handle reorders, eye toggles visibility, lock blocks edits, trash
 * deletes. Double-click the label to rename.
 */
export function LayersPanel({ clipId, elements, selectedIds, dispatch }: LayersPanelProps) {
  const ordered = [...elements].sort((a, b) => (b.z ?? 0) - (a.z ?? 0));
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  if (!clipId) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border-soft px-4 py-3 text-sm font-semibold">Layers</div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted">
          No scene under the playhead.
        </div>
      </div>
    );
  }

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ids = ordered.map((e) => e.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    const next = ids.slice();
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    dispatch({ type: "SET_ELEMENT_ORDER", clipId, orderedIds: next });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-soft px-4 py-3">
        <div className="text-sm font-semibold">Layers</div>
        <div className="text-[11px] text-faint">{ordered.length} item{ordered.length === 1 ? "" : "s"} · top = front</div>
      </div>

      {ordered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted">
          No elements on this scene yet. Add some from the Elements panel.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
          {ordered.map((el, i) => {
            const Icon = TYPE_ICON[el.type] ?? Square;
            const selected = selectedIds.includes(el.id);
            const hidden = !!el.hidden;
            const locked = !!el.locked;
            const isOver = dragOver === el.id;
            const isRenaming = renamingId === el.id;
            return (
              <div
                key={el.id}
                draggable={!isRenaming}
                onDragStart={(e) => {
                  dragId.current = el.id;
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(el.id);
                }}
                onDragLeave={() => setDragOver((v) => (v === el.id ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId.current) reorder(dragId.current, el.id);
                  dragId.current = null;
                  setDragOver(null);
                }}
                onDragEnd={() => {
                  dragId.current = null;
                  setDragOver(null);
                }}
                onClick={() =>
                  dispatch({ type: "SELECT_ELEMENTS", ids: [el.id] })
                }
                className={`group mx-1.5 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition ${
                  selected
                    ? "bg-accent/15 text-fg"
                    : "text-muted hover:bg-surface-2/60 hover:text-fg"
                } ${isOver ? "ring-1 ring-accent/60" : ""} ${
                  hidden ? "opacity-50" : ""
                }`}
              >
                <GripVertical
                  size={12}
                  className="cursor-grab text-faint opacity-60 group-hover:opacity-100"
                />
                <Icon size={13} className={selected ? "text-accent" : ""} />
                {isRenaming ? (
                  <input
                    autoFocus
                    defaultValue={elementLabel(el, i)}
                    onBlur={(e) => {
                      dispatch({
                        type: "RENAME_ELEMENT",
                        clipId,
                        elementId: el.id,
                        name: e.currentTarget.value,
                      });
                      setRenamingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.currentTarget as HTMLElement).blur();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="min-w-0 flex-1 rounded border border-border bg-surface-2 px-1 py-0.5 text-xs text-fg outline-none focus:border-accent/50"
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(el.id);
                    }}
                    className="flex-1 truncate"
                  >
                    {elementLabel(el, i)}
                  </span>
                )}

                <Tooltip content={hidden ? "Show" : "Hide"}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({
                        type: "TOGGLE_ELEMENT_HIDDEN",
                        clipId,
                        elementId: el.id,
                      });
                    }}
                    className="rounded p-0.5 text-faint hover:text-fg"
                  >
                    {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </Tooltip>
                <Tooltip content={locked ? "Unlock" : "Lock"}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({
                        type: "TOGGLE_ELEMENT_LOCKED",
                        clipId,
                        elementId: el.id,
                      });
                    }}
                    className="rounded p-0.5 text-faint hover:text-fg"
                  >
                    {locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                </Tooltip>
                <Tooltip content="Bring forward">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({
                        type: "REORDER_Z",
                        clipId,
                        elementId: el.id,
                        dir: "forward",
                      });
                    }}
                    className="rounded p-0.5 text-faint hover:text-fg"
                  >
                    <ChevronsUp size={12} />
                  </button>
                </Tooltip>
                <Tooltip content="Send backward">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({
                        type: "REORDER_Z",
                        clipId,
                        elementId: el.id,
                        dir: "backward",
                      });
                    }}
                    className="rounded p-0.5 text-faint hover:text-fg"
                  >
                    <ChevronsDown size={12} />
                  </button>
                </Tooltip>
                <Tooltip content="Delete" shortcut="⌫">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({
                        type: "SELECT_ELEMENTS",
                        ids: [el.id],
                      });
                      dispatch({ type: "DELETE_ELEMENT", clipId });
                    }}
                    className="rounded p-0.5 text-faint hover:text-danger"
                  >
                    <Trash2 size={12} />
                  </button>
                </Tooltip>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
