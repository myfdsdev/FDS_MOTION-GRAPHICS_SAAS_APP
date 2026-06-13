export const VIDEO_ASSISTANT_SCOPE_MESSAGE =
  "I can help with video generation, Remotion/software setup, rendering, audio/TTS, templates, components, prompts, and creative direction. Ask me about the video or app workflow you want to build.";

const ALLOWED_TERMS = [
  "video",
  "motion",
  "animation",
  "animate",
  "remotion",
  "render",
  "renderer",
  "template",
  "scene",
  "timeline",
  "frame",
  "fps",
  "aspect",
  "mp4",
  "component",
  "import",
  "export",
  "bundle",
  "webpack",
  "lottie",
  "caption",
  "subtitle",
  "narration",
  "voiceover",
  "audio",
  "tts",
  "piper",
  "elevenlabs",
  "music",
  "sound",
  "transition",
  "typography",
  "layout",
  "design",
  "storyboard",
  "prompt",
  "promo",
  "ad",
  "advertisement",
  "commercial",
  "explainer",
  "intro",
  "outro",
  "reel",
  "tiktok",
  "youtube",
  "shorts",
  "launch",
  "campaign",
  "brand",
  "product",
  "saas",
  "software",
  "app",
  "api",
  "backend",
  "frontend",
  "database",
  "mongodb",
  "worker",
  "canvas",
  "editor",
];

const OFF_TOPIC_TERMS = [
  "capital of",
  "weather",
  "stock price",
  "sports score",
  "recipe",
  "homework",
  "medical",
  "legal advice",
  "politics",
  "dating",
  "joke",
  "poem",
  "song lyrics",
  "translate",
];

export function isVideoAssistantTopic(input: string) {
  const text = String(input || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return false;

  const allowed = ALLOWED_TERMS.some((term) => text.includes(term));
  if (!allowed) return false;

  const offTopic = OFF_TOPIC_TERMS.some((term) => text.includes(term));
  if (!offTopic) return true;

  return /\b(video|motion|animation|render|remotion|promo|ad|explainer|script|storyboard)\b/.test(text);
}
