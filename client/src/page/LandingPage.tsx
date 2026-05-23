import { Sparkles, Star, Shield } from "lucide-react";
import { PromptComposer } from "@/components/composer/PromptComposer";

export default function LandingPage() {
  return (
    <div className="px-6 py-20 sm:py-28 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
      <div className="w-full max-w-3xl text-center">
        {/* Badge */}
        <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-surface-2 border border-border rounded-full text-sm font-medium mb-7 animate-fade-in">
          <Sparkles size={14} className="text-accent" />
          Motion graphics in seconds
        </span>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight mb-4 animate-slide-up">
          Your AI Motion &amp; Video Editor
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-muted mb-12 max-w-2xl mx-auto animate-slide-up">
          Generate animated videos with narration and music in minutes — no design skills needed.
        </p>

        {/* Composer */}
        <div className="animate-slide-up">
          <PromptComposer />
        </div>

        {/* Social proof */}
        <div className="mt-10 max-w-xl mx-auto">
          <div className="bg-surface border border-border rounded-full px-6 py-3.5 flex items-center justify-center flex-wrap gap-x-7 gap-y-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="flex text-star">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={12} fill="currentColor" />
                ))}
              </span>
              <span className="text-muted">on</span>
              <span className="font-semibold">AppSumo</span>
            </span>
            <span className="hidden sm:block w-px h-4 bg-border" />
            <span>
              <span className="font-semibold">120,000+</span>{" "}
              <span className="text-muted">creators</span>
            </span>
            <span className="hidden sm:block w-px h-4 bg-border" />
            <span className="flex items-center gap-2">
              <Shield size={14} className="text-accent" />
              <span>Free to start, no card needed</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
