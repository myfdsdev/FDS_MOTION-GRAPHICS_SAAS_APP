import { Outlet, Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useMe } from "@/lib/queries";
import { Button } from "@/components/ui/button";

export default function MarketingLayout() {
  const { data: me } = useMe();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-bg/70 border-b border-border-soft">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <Sparkles className="text-accent" size={20} />
            <span>Miltos</span>
          </Link>
          <nav className="flex items-center gap-2">
            {me ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-border bg-surface text-white hover:bg-surface-2"
                >
                  <Link to="/login">Login</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="bg-white text-bg hover:bg-neutral-200 shadow-none"
                >
                  <Link to="/register">Sign up</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
