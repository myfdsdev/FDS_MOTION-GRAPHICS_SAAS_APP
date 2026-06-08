import { useEffect, useState } from "react";
import { KeyRound, Loader2, Save, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile, useUpdateProfile } from "@/lib/queries";

type KeyName = "openai" | "gemini" | "openrouter" | "fal";

const keyRows: Array<{ id: KeyName; label: string; placeholder: string }> = [
  { id: "openrouter", label: "OpenRouter API key", placeholder: "sk-or-..." },
  { id: "openai", label: "OpenAI API key", placeholder: "sk-..." },
  { id: "gemini", label: "Gemini API key", placeholder: "AIza..." },
  { id: "fal", label: "fal.ai API key", placeholder: "fal..." },
];

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState("");
  const [keys, setKeys] = useState<Record<KeyName, string>>({
    openai: "",
    gemini: "",
    fal: "",
  });

  useEffect(() => {
    if (profile?.user) setName(profile.user.name ?? "");
  }, [profile?.user]);

  const saveProfile = async () => {
    const apiKeys = Object.fromEntries(
      Object.entries(keys).filter(([, value]) => value.trim().length > 0)
    ) as Partial<Record<KeyName, string>>;

    try {
      await updateProfile.mutateAsync({
        name: name.trim() || null,
        apiKeys: Object.keys(apiKeys).length ? apiKeys : undefined,
      });
      setKeys({ openai: "", gemini: "", fal: "" });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Profile update failed");
    }
  };

  const clearKey = async (id: KeyName) => {
    try {
      await updateProfile.mutateAsync({ apiKeys: { [id]: "" } });
      toast.success("API key cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "API key update failed");
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="mt-2 text-sm text-muted">{profile.user.email}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-lg border border-border bg-surface p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2 text-accent-soft">
              <UserRound size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Account</h2>
              <p className="text-sm text-muted">{profile.user.credits} credits</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
            />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2 text-accent-soft">
              <KeyRound size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">API keys</h2>
              <p className="text-sm text-muted">Keys are encrypted before storage.</p>
            </div>
          </div>

          <div className="space-y-5">
            {keyRows.map((row) => {
              const summary = profile.apiKeys[row.id];
              return (
                <div key={row.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={row.id}>{row.label}</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">
                        {summary.configured ? `Saved ...${summary.last4}` : "Not set"}
                      </span>
                      {summary.configured && (
                        <button
                          type="button"
                          onClick={() => clearKey(row.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-danger"
                          aria-label={`Clear ${row.label}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <Input
                    id={row.id}
                    type="password"
                    value={keys[row.id]}
                    onChange={(event) =>
                      setKeys((current) => ({
                        ...current,
                        [row.id]: event.target.value,
                      }))
                    }
                    placeholder={row.placeholder}
                    autoComplete="off"
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={saveProfile} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          Save profile
        </Button>
      </div>
    </div>
  );
}
