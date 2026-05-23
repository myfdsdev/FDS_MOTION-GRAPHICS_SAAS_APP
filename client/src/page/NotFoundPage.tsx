import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="text-7xl font-bold text-accent/80 mb-3">404</div>
      <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
      <p className="text-muted mb-6">
        That route doesn't exist. Maybe you meant somewhere else.
      </p>
      <Button asChild>
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  );
}
