import { useEffect, useState } from "react";
import { Coins, Loader2, Pencil, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useProfile, useUpdateProfile } from "@/lib/queries";

function initialsFor(name: string | null, email: string) {
  const source = (name?.trim() || email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (profile?.user) setName(profile.user.name ?? "");
  }, [profile?.user]);

  const dirtyName = profile ? name.trim() !== (profile.user.name ?? "").trim() : false;

  const saveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ name: name.trim() || null });
      setEditingName(false);
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Profile update failed");
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  const { user } = profile;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 pb-28">
      {/* ---- Identity hero — not a form, a portrait. ---- */}
      <div className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/15 via-surface to-surface p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-accent to-accent/40 text-2xl font-bold text-accent-ink shadow-accent">
              {initialsFor(user.name, user.email)}
            </div>
            {user.isAdmin && (
              <div
                className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-bg bg-surface text-accent"
                title="Admin"
              >
                <ShieldCheck size={13} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {editingName ? (
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                placeholder="Your name"
                className="w-full max-w-xs border-b border-accent/50 bg-transparent text-2xl font-bold text-fg outline-none placeholder:text-faint"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="group inline-flex items-center gap-2 text-2xl font-bold text-fg"
              >
                {name.trim() || "Add your name"}
                <Pencil size={14} className="text-faint opacity-0 transition group-hover:opacity-100" />
              </button>
            )}
            <p className="mt-1 text-sm text-muted">{user.email}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-fg">
                <Coins size={12} className="text-accent" />
                {user.credits} credits
              </span>
              {user.isAdmin && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-surface-2/60 px-3 py-1 text-xs text-muted">
                  <ShieldCheck size={12} />
                  Admin
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-surface-2/60 px-3 py-1 text-xs text-muted">
                Member since {new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Sticky save bar — only appears once there's a name change. ---- */}
      {dirtyName && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-soft bg-bg/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-3">
            <span className="text-xs text-muted">You have unsaved changes</span>
            <Button onClick={saveProfile} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
