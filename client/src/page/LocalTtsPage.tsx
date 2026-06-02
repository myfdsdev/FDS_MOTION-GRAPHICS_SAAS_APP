import { useState } from "react";
import { Download, Loader2, Play, Waves } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateLocalTts } from "@/lib/api";
import type { LocalTtsResult } from "@/types";

const DEFAULT_TEXT = "Hello from my project.";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LocalTtsPage() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [result, setResult] = useState<LocalTtsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Enter text first");
      return;
    }

    setLoading(true);
    try {
      const audio = await generateLocalTts(trimmed);
      setResult(audio);
      toast.success("Voice generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Piper generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-surface-2 text-accent-soft">
            <Waves size={20} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Local Piper TTS</h1>
            <p className="mt-1 text-sm text-muted">Generate WAV voice files from your local model.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="rounded-lg border border-border bg-surface p-6">
          <label htmlFor="tts-text" className="mb-3 block text-sm font-medium text-muted">
            Voice text
          </label>
          <textarea
            id="tts-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={2000}
            className="min-h-56 w-full resize-y rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm leading-6 text-fg outline-none transition focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
            placeholder="Write the voiceover text..."
          />
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="text-xs text-faint">{text.trim().length}/2000 characters</span>
            <Button onClick={submit} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {loading ? "Generating" : "Generate WAV"}
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Generated audio</h2>
            <p className="mt-1 text-sm text-muted">Piper output is saved by the backend.</p>
          </div>

          {result ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-border-soft bg-surface-2 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">{result.fileName}</span>
                  <span className="shrink-0 text-xs text-muted">{formatBytes(result.size)}</span>
                </div>
                <audio src={result.url} controls className="w-full" />
              </div>

              <Button asChild variant="secondary" className="w-full">
                <a href={result.url} download={result.fileName}>
                  <Download size={16} />
                  Download WAV
                </a>
              </Button>

              <p className="break-all rounded-lg bg-bg-deep px-3 py-2 text-xs text-faint">
                {result.url}
              </p>
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-border-soft bg-surface-2 text-center">
              <div>
                <Waves className="mx-auto text-faint" size={34} />
                <p className="mt-3 text-sm text-muted">No audio generated yet</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
