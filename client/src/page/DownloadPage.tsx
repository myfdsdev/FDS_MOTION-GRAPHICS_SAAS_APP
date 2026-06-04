import { useParams, Link } from "react-router-dom";
import {
  Download,
  ArrowLeft,
  Share2,
  RotateCcw,
  Check,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useProject, useRerender } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const FORMATS = [
  { label: "MP4 · 1080p", quality: "1080p", ext: "mp4" },
  { label: "MP4 · 720p", quality: "720p", ext: "mp4" },
  { label: "WebM · 1080p", quality: "1080p", ext: "webm" },
];

export default function DownloadPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useProject(id);
  const rerender = useRerender();
  const [copied, setCopied] = useState(false);

  if (!project) {
    return <div className="p-8">Loading…</div>;
  }

  if (project.status !== "DONE") {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <h1 className="text-xl font-semibold mb-2">Not ready yet</h1>
        <p className="text-muted mb-4">This video is still being generated.</p>
        <Button asChild>
          <Link to={`/projects/${id}/edit`}>
            <ArrowLeft size={14} /> Back to preview
          </Link>
        </Button>
      </div>
    );
  }

  const handleShare = () => {
    const url = `${window.location.origin}/projects/${project.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Share link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (format: (typeof FORMATS)[number]) => {
    toast.success(`${format.label} download started`);
    // In real app: window.location.href = project.outputUrl
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        to={`/projects/${id}/edit`}
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to preview
      </Link>

      <div className="bg-surface border border-border rounded-2xl p-8 shadow-card">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center">
            <Sparkles size={18} className="text-success" />
          </div>
          <div>
            <div className="text-xs text-muted">Ready to download</div>
            <h1 className="text-xl font-semibold">Your video is done</h1>
          </div>
        </div>

        {/* Preview */}
        <div
          className="aspect-video rounded-xl border border-border my-6 relative overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #0f0f0f 0%, #1a0f2e 50%, #2a1f3d 100%)",
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles size={32} className="text-accent opacity-50" />
          </div>
        </div>

        {/* Download options */}
        <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wider">
          Choose a format
        </h2>
        <div className="space-y-2 mb-6">
          {FORMATS.map((f) => (
            <button
              key={f.label}
              onClick={() => handleDownload(f)}
              className="w-full flex items-center justify-between bg-surface-2 hover:bg-surface-3 border border-border rounded-lg p-4 transition-colors text-left"
            >
              <div>
                <div className="font-medium">{f.label}</div>
                <div className="text-xs text-muted mt-0.5">
                  {f.quality} · {f.ext.toUpperCase()}
                </div>
              </div>
              <Download size={16} className="text-muted" />
            </button>
          ))}
        </div>

        {/* Secondary actions */}
        <div className="flex flex-wrap gap-2 pt-5 border-t border-border-soft">
          <Button variant="secondary" size="sm" onClick={handleShare}>
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            {copied ? "Copied" : "Copy share link"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => rerender.mutateAsync(project.id)}
            disabled={rerender.isPending}
          >
            <RotateCcw size={14} />
            Re-render
          </Button>
        </div>
      </div>
    </div>
  );
}
