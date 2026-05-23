import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegister } from "@/lib/queries";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const reg = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await reg.mutateAsync(data);
      toast.success("Account created · 30 free credits added");
      navigate("/dashboard", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <Link to="/" className="flex items-center gap-2 mb-8 font-bold text-lg">
        <Sparkles className="text-accent" size={20} />
        Miltos
      </Link>

      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8 shadow-card">
        <h1 className="text-2xl font-bold mb-1.5">Create your account</h1>
        <p className="text-sm text-muted mb-6">
          Start with{" "}
          <span className="text-accent-soft font-semibold">30 free credits</span> — no
          card needed.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Jane Creator" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-danger">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-danger">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-danger">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={reg.isPending}>
            {reg.isPending && <Loader2 size={14} className="animate-spin" />}
            Create account
          </Button>
        </form>

        <div className="text-center text-sm text-muted mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-accent-soft hover:text-accent font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
