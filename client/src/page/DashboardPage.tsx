import { Link } from "react-router-dom";
import { Plus, Sparkles } from "lucide-react";
import { useMe } from "@/lib/queries";
import { CleanComposer } from "@/components/composer/CleanComposer";
import { Button } from "@/components/ui/button";

export default function DashboardPage({
  section = "ai-video",
}: {
  section?: "ai-video" | "motion-graphics";
}) {
  const { data: me } = useMe();
  const firstName = me?.name?.split(" ")[0] ?? "there";
  const greeting =
    section === "motion-graphics" ? "Motion Graphics" : `Back at it, ${firstName}`;

  // Chat-only page: just the centered composer. Past work lives on /projects.
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
      <CleanComposer greeting={greeting} section={section} />
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
        <Link to="/dashboard">
          <Plus size={15} />
          Create video
        </Link>
      </Button>
    </div>
  );
}
