import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/lib/queries";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login.mutateAsync(data);
      toast.success("Welcome back");
      navigate(from, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-lg border border-border bg-surface shadow-card lg:grid-cols-[1fr_0.92fr]">
          <div className="px-6 py-7 sm:px-10 sm:py-10">
            <Link
              to="/"
              className="mb-10 inline-flex items-center gap-2 text-lg font-bold"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface-2">
                <Sparkles className="text-accent" size={18} />
              </span>
              Miltos
            </Link>

            <div className="mb-7">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent-soft">
                Creator workspace
              </p>
              <h1 className="text-3xl font-bold tracking-normal text-white">
                Welcome back
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                Sign in to continue building your video projects.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
                    size={17}
                  />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="h-12 bg-[#eef4ff] pl-10 text-[#111827] placeholder:text-[#64748b] focus-visible:ring-offset-surface"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-danger">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <LockKeyhole
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
                    size={17}
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="h-12 bg-[#eef4ff] pl-10 pr-11 text-[#111827] placeholder:text-[#64748b] focus-visible:ring-offset-surface"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#475569] transition-colors hover:bg-[#dbe7f8] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-danger">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="h-12 w-full"
                disabled={login.isPending}
              >
                {login.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowRight size={16} />
                )}
                Sign in
              </Button>
            </form>

            <div className="mt-7 text-center text-sm text-muted">
              New to Miltos?{" "}
              <Link
                to="/register"
                className="font-semibold text-accent-soft hover:text-accent"
              >
                Create an account
              </Link>
            </div>
          </div>

          <aside className="hidden border-l border-border bg-[#101010] p-8 lg:flex lg:flex-col lg:justify-between">
            <div className="space-y-6">
              <div className="overflow-hidden rounded-lg border border-border bg-bg">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success" />
                </div>
                <div className="space-y-5 p-5">
                  <div className="h-32 rounded-lg border border-border bg-[linear-gradient(135deg,#172033_0%,#1f1f1f_46%,#3b256d_100%)]" />
                  <div className="space-y-2">
                    <div className="h-3 w-28 rounded-full bg-surface-3" />
                    <div className="h-3 w-full rounded-full bg-surface-2" />
                    <div className="h-3 w-2/3 rounded-full bg-surface-2" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {["Plan", "Assets", "Render"].map((item) => (
                  <div
                    key={item}
                    className="rounded-lg border border-border bg-surface px-3 py-4 text-center"
                  >
                    <div className="mx-auto mb-2 h-1.5 w-8 rounded-full bg-accent" />
                    <p className="text-xs font-medium text-muted">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-8 text-sm leading-6 text-muted">
              Your motion projects, credits, and render history stay synced with
              your account.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
