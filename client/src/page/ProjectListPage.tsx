import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useProjects } from "@/lib/queries";
import { ProjectCard } from "@/components/project/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectStatus } from "@/types";
import { cn } from "@/lib/utils";

const FILTERS: { label: string; value: ProjectStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Done", value: "DONE" },
  { label: "In progress", value: "RENDERING" },
  { label: "Failed", value: "FAILED" },
];

export default function ProjectListPage() {
  const { data: projects, isLoading } = useProjects();
  const [filter, setFilter] = useState<ProjectStatus | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = (projects ?? []).filter((p) => {
    if (filter !== "all") {
      if (filter === "RENDERING") {
        if (p.status === "DONE" || p.status === "FAILED") return false;
      } else if (p.status !== filter) return false;
    }
    if (query && !p.prompt.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Projects</h1>
          <p className="text-muted">All your generated videos in one place.</p>
        </div>
        <Button asChild>
          <Link to="/dashboard">
            <Plus size={15} /> New video
          </Link>
        </Button>
      </div>

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prompts…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 self-start">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                filter === f.value
                  ? "bg-surface-3 text-fg"
                  : "text-muted hover:text-fg"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="aspect-video bg-surface-2 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <p className="text-muted text-sm mb-4">
            {query || filter !== "all"
              ? "No projects match your filters."
              : "You haven't created any projects yet."}
          </p>
          {!query && filter === "all" && (
            <Button asChild>
              <Link to="/dashboard">
                <Plus size={15} /> Create your first video
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
