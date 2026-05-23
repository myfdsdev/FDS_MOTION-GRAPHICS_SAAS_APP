import { Link } from "react-router-dom";
import { Plus, Sparkles } from "lucide-react";
import { useMe, useProjects } from "@/lib/queries";
import { ProjectCard } from "@/components/project/ProjectCard";
import { CleanComposer } from "@/components/composer/CleanComposer";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { data: me } = useMe();
  const { data: projects, isLoading } = useProjects();

  const recent = projects?.slice(0, 6) ?? [];
  const firstName = me?.name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero: centered greeting + prompt box */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <CleanComposer greeting={`Back at it, ${firstName}`} />
      </div>

      {/* Recent projects */}
      {(isLoading || recent.length > 0) && (
        <div className="w-full max-w-6xl mx-auto px-8 pb-16">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent projects</h2>
            <Link to="/projects" className="text-sm text-accent-soft hover:text-accent">
              View all →
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="aspect-video bg-surface-2 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {recent.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Kept for reference; the empty state is now simply the centered composer.
export function DashboardEmpty() {
  return (
    <div className="rounded-xl border border-dashed border-border p-16 text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent/15 flex items-center justify-center">
        <Sparkles size={20} className="text-accent" />
      </div>
      <h3 className="font-semibold mb-1">No projects yet</h3>
      <p className="text-sm text-muted mb-5">Create your first AI-generated video in seconds.</p>
      <Button asChild>
        <Link to="/create">
          <Plus size={15} />
          Create video
        </Link>
      </Button>
    </div>
  );
}
