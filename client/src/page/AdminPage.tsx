import { useState, type FormEvent } from "react";
import { useDropzone } from "react-dropzone";
import Lottie from "lottie-react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  Gauge,
  KeyRound,
  Library,
  Loader2,
  Server,
  UploadCloud,
  Users,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  useAdminOverview,
  useLottieAssets,
  useMe,
  useProviderKeys,
  useSaveProviderKeys,
  useUpdateAdminSettings,
  useUploadLottieAsset,
} from "@/lib/queries";
import { getLottieAnimation, type ProviderKeySummary } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { LottieAssetSummary, VideoCategory } from "@/types";

const statCards = [
  { key: "users", label: "Users", icon: Users },
  { key: "projects", label: "Projects", icon: Activity },
  { key: "doneProjects", label: "Done", icon: CheckCircle2 },
  { key: "failedProjects", label: "Failed", icon: AlertTriangle },
] as const;

const numberFormat = new Intl.NumberFormat("en");
const lottieCategories: VideoCategory[] = [
  "business",
  "personal",
  "saas",
  "marketing",
  "local-business",
];

function formatNumber(value: number) {
  return numberFormat.format(value || 0);
}

function formatProvider(provider: string) {
  return provider === "openai" ? "OpenAI" : provider === "openrouter" ? "OpenRouter" : "Gemini";
}

function formatKeySource(source: string) {
  return source === "user" ? "User key" : "Server key";
}

function formatCategory(category: string) {
  return category.replace("-", " ");
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatUsagePeriod(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} - ${endDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

export default function AdminPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const isAdmin = Boolean(me?.isAdmin);
  const { data, isLoading } = useAdminOverview(isAdmin);
  const { data: lottieAssets = [], isLoading: lottieLoading } = useLottieAssets(isAdmin);
  const updateSettings = useUpdateAdminSettings();
  const uploadLottie = useUploadLottieAsset();
  const [lottieLabel, setLottieLabel] = useState("");
  const [lottieCategory, setLottieCategory] = useState<string>("business");
  const [customCategory, setCustomCategory] = useState(false);
  const [lottieTags, setLottieTags] = useState("");
  const [lottieFileName, setLottieFileName] = useState("");
  const [lottieJson, setLottieJson] = useState<Record<string, unknown> | null>(null);

  const loadLottieFile = async (file: File) => {
    setLottieFileName(file.name);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isJsonObject(parsed) || !Array.isArray(parsed.layers)) {
        throw new Error("That's not a Lottie JSON export (no layers array).");
      }
      setLottieJson(parsed);
      // Auto-name from the file name.
      setLottieLabel(
        file.name.replace(/\.(json|lottie)$/i, "").replace(/[-_]+/g, " ").trim()
      );
      toast.success("Lottie ready — pick a category and add it");
    } catch (err) {
      setLottieJson(null);
      setLottieFileName("");
      toast.error(err instanceof Error ? err.message : "Could not read that file");
    }
  };

  const dropzone = useDropzone({
    accept: { "application/json": [".json"], "text/plain": [".json"] },
    maxFiles: 1,
    multiple: false,
    onDrop: (accepted) => {
      if (accepted[0]) loadLottieFile(accepted[0]);
    },
  });

  if (!meLoading && !isAdmin) return <Navigate to="/dashboard" replace />;

  if (meLoading || isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading...
      </div>
    );
  }

  const apiUsage = data.apiUsage;
  const usagePercent = Math.min(100, Math.max(0, apiUsage.percentOfLimit));
  const usageBarWidth = usagePercent === 0 ? "0%" : `${Math.max(2, usagePercent)}%`;
  const usageBadgeVariant =
    usagePercent >= 90 ? "danger" : usagePercent >= 75 ? "warning" : "accent";
  const userKeysEnabled = data.settings.allowUserApiKeys;

  // Existing categories (base + already-used) to suggest in the combobox.
  const knownCategories = Array.from(
    new Set([...lottieCategories, ...lottieAssets.map((asset) => asset.category)])
  ).sort();

  const toggleUserApiKeys = async () => {
    const nextValue = !userKeysEnabled;

    try {
      await updateSettings.mutateAsync({ allowUserApiKeys: nextValue });
      toast.success(`User API keys ${nextValue ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setting update failed");
    }
  };

  const handleUploadLottie = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const label = lottieLabel.trim();
    if (!label) {
      toast.error("Add a name for this animation");
      return;
    }

    if (!lottieJson) {
      toast.error("Choose a Lottie JSON file first");
      return;
    }

    const tags = lottieTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      await uploadLottie.mutateAsync({
        label,
        category: lottieCategory.trim() || "business",
        tags,
        animationData: lottieJson,
      });
      toast.success("Lottie animation added");
      setLottieLabel("");
      setLottieTags("");
      setLottieFileName("");
      setLottieJson(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lottie upload failed");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="mt-2 text-sm text-muted">System overview and recent activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map(({ key, label, icon: Icon }) => (
          <section key={key} className="rounded-lg border border-border bg-surface p-5">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-accent-soft">
              <Icon size={17} />
            </div>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold">{data.stats[key]}</p>
          </section>
        ))}
      </div>

      <section className="mt-6 rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-accent-soft">
              <KeyRound size={17} />
            </div>
            <h2 className="text-lg font-semibold">User API keys</h2>
            <p className="mt-1 text-sm text-muted">
              {userKeysEnabled ? "Profile keys enabled" : "Server keys only"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={userKeysEnabled}
            aria-label="Toggle user API keys"
            disabled={updateSettings.isPending}
            onClick={toggleUserApiKeys}
            className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-surface-2 p-0.5 transition-colors aria-checked:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              className={`block h-5 w-5 rounded-full bg-fg shadow transition-transform ${
                userKeysEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </section>

      <ProviderKeysSection isAdmin={isAdmin} />

      <section className="mt-6 rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-accent-soft">
              <KeyRound size={17} />
            </div>
            <h2 className="text-lg font-semibold">API key usage</h2>
            <p className="mt-1 text-sm text-muted">
              {formatUsagePeriod(apiUsage.periodStart, apiUsage.periodEnd)}
            </p>
          </div>
          <Badge variant={usageBadgeVariant} className="w-fit">
            <Gauge size={13} />
            {usagePercent}% used
          </Badge>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">{formatNumber(apiUsage.totalTokens)} tokens</span>
            <span className="text-muted">
              {formatNumber(apiUsage.monthlyTokenLimit)} monthly limit
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-soft to-success transition-all"
              style={{ width: usageBarWidth }}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-sm text-muted">Requests</p>
            <p className="text-xl font-bold">{formatNumber(apiUsage.totalRequests)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Input tokens</p>
            <p className="text-xl font-bold">{formatNumber(apiUsage.inputTokens)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Output tokens</p>
            <p className="text-xl font-bold">{formatNumber(apiUsage.outputTokens)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Last used</p>
            <p className="text-xl font-bold">
              {apiUsage.lastUsedAt ? formatRelativeTime(apiUsage.lastUsedAt) : "Never"}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {apiUsage.byProvider.length ? (
            apiUsage.byProvider.map((provider) => {
              const providerPercent = apiUsage.totalTokens
                ? Math.round((provider.totalTokens / apiUsage.totalTokens) * 100)
                : 0;
              const providerWidth =
                providerPercent === 0 ? "0%" : `${Math.max(2, providerPercent)}%`;

              return (
                <div key={`${provider.provider}-${provider.keySource}`}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium">
                      {formatProvider(provider.provider)} /{" "}
                      <span className="text-muted">{formatKeySource(provider.keySource)}</span>
                    </span>
                    <span className="text-muted">
                      {formatNumber(provider.totalTokens)} tokens /{" "}
                      {formatNumber(provider.requests)} requests
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent-soft"
                      style={{ width: providerWidth }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
              No tracked API calls this month.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Library size={17} />
            </div>
            <h2 className="text-lg font-semibold">Lottie library</h2>
            <p className="mt-1 text-sm text-muted">
              Drop a Lottie JSON — the name fills in automatically. Just pick a category.
            </p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
            {lottieAssets.length} assets
          </span>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form className="space-y-4" onSubmit={handleUploadLottie}>
            {/* Drag & drop zone */}
            <div
              {...dropzone.getRootProps()}
              className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                dropzone.isDragActive
                  ? "border-accent bg-accent/10"
                  : lottieJson
                    ? "border-accent/50 bg-accent/5"
                    : "border-border bg-surface-2 hover:border-accent/40 hover:bg-surface-3"
              }`}
            >
              <input {...dropzone.getInputProps()} />
              {lottieJson ? (
                <>
                  <Lottie
                    animationData={lottieJson}
                    loop
                    className="h-28 w-28"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="mt-1 flex items-center gap-1.5 text-sm font-medium text-fg">
                    <FileJson size={14} className="text-accent" />
                    {lottieFileName}
                  </span>
                  <span className="mt-0.5 text-xs text-accent-soft">Preview above · choose a category below</span>
                </>
              ) : (
                <>
                  <UploadCloud size={26} className="mb-2 text-muted" />
                  <span className="text-sm font-medium text-fg">
                    {dropzone.isDragActive ? "Drop it here" : "Drag & drop a Lottie JSON"}
                  </span>
                  <span className="mt-1 text-xs text-faint">or click to browse · .json from LottieFiles</span>
                </>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Name</label>
              <input
                value={lottieLabel}
                onChange={(event) => setLottieLabel(event.target.value)}
                placeholder="Auto-filled from the file"
                className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg outline-none transition focus:border-accent/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Category</label>
              <div className="flex flex-wrap gap-2">
                {knownCategories.map((category) => {
                  const active = !customCategory && lottieCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setCustomCategory(false);
                        setLottieCategory(category);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
                        active
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-border bg-surface-2 text-fg hover:border-accent/50"
                      }`}
                    >
                      {formatCategory(category)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setCustomCategory(true);
                    setLottieCategory("");
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    customCategory
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-border bg-surface-2 text-fg hover:border-accent/50"
                  }`}
                >
                  + Custom
                </button>
              </div>
              {customCategory && (
                <input
                  autoFocus
                  value={lottieCategory}
                  onChange={(event) => setLottieCategory(event.target.value)}
                  placeholder="Type a new category, e.g. healthcare"
                  className="mt-2 h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg outline-none transition focus:border-accent/50"
                />
              )}
              <p className="mt-1 text-xs text-faint">
                {customCategory
                  ? "Type a new category to create it."
                  : "Pick a category, or choose Custom to add a new one."}
              </p>
            </div>

            <button
              type="submit"
              disabled={uploadLottie.isPending || !lottieJson}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploadLottie.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              Add animation
            </button>
          </form>

          <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Available animations
              </h3>
              {lottieLoading ? (
                <Loader2 size={16} className="animate-spin text-faint" />
              ) : null}
            </div>

            {lottieAssets.length ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 max-h-[520px] overflow-y-auto scrollbar-thin pr-1">
                {lottieAssets.map((asset) => (
                  <LottieTile key={asset.id} asset={asset} />
                ))}
              </div>
            ) : (
              <p className="py-4 text-sm text-muted">No Lottie assets yet.</p>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-lg font-semibold">Recent users</h2>
          <div className="space-y-3">
            {data.recentUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.name ?? "User"}</p>
                  <p className="truncate text-xs text-muted">{user.email}</p>
                </div>
                <p className="shrink-0 text-xs text-muted">{user.credits} credits</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-lg font-semibold">Recent projects</h2>
          <div className="space-y-3">
            {data.recentProjects.map((project) => (
              <div key={project.id} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{project.prompt}</p>
                  <p className="text-xs text-muted">
                    {project.status} - {formatRelativeTime(project.createdAt)}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted">{project.progress}%</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-surface p-5">
        <h2 className="mb-4 text-lg font-semibold">Credits</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted">Issued</p>
            <p className="text-xl font-bold">{data.stats.creditsIssued}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Spent</p>
            <p className="text-xl font-bold">{data.stats.creditsSpent}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Running</p>
            <p className="text-xl font-bold">{data.stats.runningProjects}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Gallery tile — lazily fetches the asset's animation JSON and plays it (LottieFiles-style).
function LottieTile({ asset }: { asset: LottieAssetSummary }) {
  const { data, isLoading } = useQuery({
    queryKey: ["lottie-animation", asset.id],
    queryFn: () => getLottieAnimation(asset.id),
    staleTime: Infinity,
  });

  return (
    <div
      title={`${asset.label} · ${formatCategory(asset.category)}`}
      className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-2"
    >
      <div className="absolute inset-0 grid place-items-center p-3">
        {data ? (
          <Lottie animationData={data} loop className="h-full w-full" />
        ) : isLoading ? (
          <Loader2 size={18} className="animate-spin text-faint" />
        ) : (
          <span className="text-[10px] text-faint">no preview</span>
        )}
      </div>
      <span className="absolute right-1.5 top-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/80 backdrop-blur">
        {asset.source}
      </span>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-xs font-medium text-white">{asset.label}</p>
        <p className="truncate text-[10px] capitalize text-white/60">{formatCategory(asset.category)}</p>
      </div>
    </div>
  );
}

const KEY_CATEGORY_LABELS: Record<string, string> = {
  brain: "LLM / Brain — writes scripts & scene plans",
  media: "Media generation — images, video, music",
  voice: "Voice — narration",
};

function ProviderKeysSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: providers = [], isLoading } = useProviderKeys(isAdmin);
  const saveKeys = useSaveProviderKeys();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const dirty = Object.entries(drafts).filter(([, v]) => v.trim().length > 0);

  const onSave = async () => {
    const keys: Record<string, string> = {};
    for (const [id, v] of dirty) keys[id] = v.trim();
    if (!Object.keys(keys).length) return;
    try {
      await saveKeys.mutateAsync(keys);
      setDrafts({});
      toast.success(`Saved ${Object.keys(keys).length} key(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save keys");
    }
  };

  const onClear = async (id: string, label: string) => {
    try {
      await saveKeys.mutateAsync({ [id]: "" });
      setDrafts((d) => ({ ...d, [id]: "" }));
      toast.success(`Cleared ${label} (falls back to .env)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clear key");
    }
  };

  const grouped = providers.reduce<Record<string, ProviderKeySummary[]>>((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-5">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-accent-soft">
            <Server size={17} />
          </div>
          <h2 className="text-lg font-semibold">Provider API keys</h2>
          <p className="mt-1 text-sm text-muted">
            Stored encrypted. A saved key overrides the matching <code className="text-faint">.env</code> value;
            clear it to fall back. Keys are never shown again — only the last 4 characters.
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saveKeys.isPending || dirty.length === 0}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveKeys.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
          Save {dirty.length > 0 ? `(${dirty.length})` : ""}
        </button>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted">Loading keys…</p>
      ) : (
        <div className="mt-4 space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
                {KEY_CATEGORY_LABELS[category] ?? category}
              </p>
              <div className="space-y-2.5">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-2 rounded-md border border-border bg-surface-2/40 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-sm font-medium">{p.label}</span>
                      {p.configured ? (
                        <Badge variant={p.source === "db" ? "accent" : "warning"} className="shrink-0">
                          {p.source === "db" ? "saved" : "from .env"} ····{p.last4}
                        </Badge>
                      ) : (
                        <Badge variant="default" className="shrink-0">not set</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        autoComplete="off"
                        placeholder={p.configured ? "Replace key…" : "Paste key…"}
                        value={drafts[p.id] ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                        className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent sm:w-64"
                      />
                      {p.source === "db" ? (
                        <button
                          type="button"
                          onClick={() => onClear(p.id, p.label)}
                          disabled={saveKeys.isPending}
                          className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-fg disabled:opacity-50"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
