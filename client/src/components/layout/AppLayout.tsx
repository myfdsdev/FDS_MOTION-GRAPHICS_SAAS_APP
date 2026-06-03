import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import {
  Clapperboard,
  Plus,
  FolderClock,
  LogOut,
  Menu,
  Sparkles,
  Coins,
  AudioLines,
  UserRound,
  ShieldCheck,
  X,
} from "lucide-react";
import { useMe, useLogout, useProjects } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const NAV = [
  { to: "/projects", label: "Projects", icon: FolderClock },
];

export default function AppLayout() {
  const { data: me, isLoading } = useMe();
  const { data: projects } = useProjects();
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();

  // The "Editor" link opens the most recent project (or the dashboard if none).
  const latestProjectId = projects?.[0]?.id;
  const editorTo = latestProjectId ? `/projects/${latestProjectId}/edit` : "/dashboard";

  const navItems = [
    { to: "/dashboard", label: "Create with AI", icon: Plus },
    { to: editorTo, label: "Editor", icon: Clapperboard },
    { to: "/local-tts", label: "Local TTS", icon: AudioLines },
    ...NAV,
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading…</div>
      </div>
    );
  }

  if (!me) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate("/");
  };

  // Mobile drawer — open via the hamburger; auto-close when the route changes.
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex">
      {/* Mobile top bar — only visible below md. */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border-soft bg-bg/85 px-3 backdrop-blur md:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="text-accent" size={16} />
          Miltos
        </div>
        <span className="w-9" />
      </div>

      {/* Drawer scrim — closes the drawer when clicked. */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Sidebar — slides in on mobile, persistent on md+. */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border-soft bg-bg/95 backdrop-blur-xl transition-transform md:static md:translate-x-0 md:bg-bg/60",
          drawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-border-soft px-5">
          <span className="flex items-center gap-2">
            <Sparkles className="text-accent" size={20} />
            <span className="font-bold">Miltos</span>
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg md:hidden"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {[...navItems, ...(me.isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : [])].map((item) => {
            const path = location.pathname;
            const onEditor = path.endsWith("/edit");
            let active = false;
            if (item.label === "Editor") active = onEditor;
            else if (item.to === "/dashboard") active = path === "/dashboard";
            else if (item.to === "/local-tts") active = path === "/local-tts";
            else if (item.to === "/projects") active = path.startsWith("/projects") && !onEditor;
            else active = path === item.to || path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-surface-2 text-fg"
                    : "text-muted hover:text-fg hover:bg-surface-2/60"
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border-soft">
          <Link
            to="/billing"
            className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-2 border border-border hover:border-accent/40 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm">
              <Coins size={15} className="text-accent" />
              <span className="text-muted">Credits</span>
            </span>
            <span className="font-semibold">{me.credits}</span>
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="relative flex-1 min-w-0 pt-14 md:pt-0">
        {/* Top-right account menu */}
        <div className="absolute right-4 top-3 z-30">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent-soft ring-1 ring-border transition hover:ring-accent/50"
                aria-label="Account menu"
              >
                {(me.name ?? me.email)[0].toUpperCase()}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-2">
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent-soft">
                  {(me.name ?? me.email)[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{me.name ?? "User"}</div>
                  <div className="truncate text-xs text-muted">{me.email}</div>
                </div>
              </div>

              <div className="my-1 h-px bg-border-soft" />

              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-fg hover:bg-surface-2"
              >
                <UserRound size={15} className="text-muted" /> Profile
              </Link>
              <Link
                to="/billing"
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-fg hover:bg-surface-2"
              >
                <Coins size={15} className="text-muted" /> Billing
              </Link>

              <div className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-fg">
                <span className="text-muted">Theme</span>
                <ThemeToggle className="h-7 w-7" />
              </div>

              <div className="my-1 h-px bg-border-soft" />

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-danger hover:bg-surface-2"
              >
                <LogOut size={15} /> Log out
              </button>
            </PopoverContent>
          </Popover>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
