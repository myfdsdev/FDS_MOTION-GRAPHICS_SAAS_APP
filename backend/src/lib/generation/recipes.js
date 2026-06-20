// recipes.js — video-TYPE archetypes for the Scene Planner.
//
// THE PROBLEM THIS SOLVES
// The planner only ever emits a scenePlan (JSON, never code), so every video
// it produced came out the same SHAPE: footage in the back, a title overlay on
// top, voiceover under. The renderer can do far more than that — it just was
// never told to. A "recipe" is a small instruction pack that steers the planner
// toward a genuinely different KIND of video, reusing the SAME safe vocabulary
// the SceneRenderer already supports (no code-gen, no new components required).
//
// A recipe controls:
//   - the structural beats (how scenes flow: establish -> reveal -> CTA, etc.)
//   - which overlay types to FAVOR (charts vs. titles vs. callouts)
//   - the background strategy: "footage" (generate AI clips, costs credits),
//     "graphics" (flat/gradient color, FREE + fast), or "mixed"
//   - default aspect ratio + pacing
//
// Original code. No third-party content vendored.

/**
 * @typedef {Object} Recipe
 * @property {string} id
 * @property {string} label
 * @property {string} description     one line for a UI picker
 * @property {"16:9"|"9:16"|"1:1"|"4:3"} aspectRatio   default canvas
 * @property {"footage"|"graphics"|"mixed"} background  generation strategy
 * @property {[number, number]} sceneRange  [min, max] scenes
 * @property {string[]} favorOverlays   overlay types this archetype leans on
 * @property {string[]} keywords        for deterministic auto-selection
 * @property {string} guidance          the prompt block injected into the planner
 */

/** @type {Record<string, Recipe>} */
export const RECIPES = {
  // ---------------------------------------------------------------- cinematic
  "cinematic-ad": {
    id: "cinematic-ad",
    label: "Cinematic Ad",
    description: "AI cinematic footage with minimal title/CTA overlays + voiceover. The default.",
    aspectRatio: "16:9",
    background: "footage",
    sceneRange: [4, 6],
    favorOverlays: ["heroTitle", "sectionTitle", "statReveal", "providerChip"],
    keywords: ["ad", "advert", "commercial", "cinematic", "brand", "launch", "promo", "trailer", "story", "film"],
    guidance: `
VIDEO TYPE: Cinematic Ad.
Every scene background is AI-generated footage (background.kind "video",
source "generate") with a rich, photoreal asset.prompt. Overlays are SPARSE —
one strong heroTitle/sectionTitle per scene, an optional statReveal, and a
final logo/CTA card. Let the footage carry the emotion; text is the punctuation.
Beats: HOOK -> PROBLEM/CONTEXT -> PRODUCT/REVEAL -> PROOF -> CTA.
Use scrim 0.35-0.5 on every scene (text sits on footage).`,
  },

  // ----------------------------------------------------------- data explainer
  "data-explainer": {
    id: "data-explainer",
    label: "Data Explainer",
    description: "Charts, KPIs and stat reveals on clean color/gradient backgrounds. No footage cost.",
    aspectRatio: "16:9",
    background: "graphics",
    sceneRange: [4, 6],
    favorOverlays: ["barChart", "lineChart", "pieChart", "kpiGrid", "statReveal", "sectionTitle"],
    keywords: ["data", "stats", "statistics", "metrics", "report", "growth", "results", "chart", "analytics", "dashboard", "revenue", "kpi", "numbers", "explainer", "infographic"],
    guidance: `
VIDEO TYPE: Data Explainer (motion-graphics, NO AI footage).
Backgrounds are FLAT or gradient COLOR (background.kind "color", set a tasteful
"color" hex; do NOT set source "generate" — this video uses zero footage).
Each scene is built around ONE data overlay: barChart, lineChart, pieChart,
kpiGrid, or a big statReveal, introduced by a sectionTitle. Provide REAL,
plausible data arrays in the overlay props (labels + values that fit the
subject). Set background.scrim to 0 (the color is already clean).
Beats: TITLE -> METRIC 1 -> METRIC 2 -> TREND/CHART -> TAKEAWAY.`,
  },

  // ------------------------------------------------------- kinetic typography
  "kinetic-typography": {
    id: "kinetic-typography",
    label: "Kinetic Typography",
    description: "Bold animated text on color backgrounds, no footage. Fast, punchy, free to render.",
    aspectRatio: "16:9",
    background: "graphics",
    sceneRange: [4, 6],
    favorOverlays: ["kineticTitle", "heroTitle", "sectionTitle", "textCard", "calloutBox", "particles"],
    keywords: ["typography", "quote", "lyrics", "manifesto", "text", "words", "message", "announcement", "tagline", "motivational", "kinetic"],
    guidance: `
VIDEO TYPE: Kinetic Typography (text-driven, NO AI footage).
Backgrounds are bold FLAT COLOR (background.kind "color" with a punchy "color"
hex that changes scene to scene; never source "generate"). The MESSAGE is the
star: each scene shows 1-2 short text overlays (heroTitle / sectionTitle /
textCard / calloutBox) with timed fromFrames so phrases land in rhythm. Use a
particles overlay sparingly for accent. Keep copy short and quotable.
Set background.scrim to 0. Beats: HOOK LINE -> BUILD -> BUILD -> PAYOFF LINE.`,
  },

  // -------------------------------------------------------- product showcase
  "product-showcase": {
    id: "product-showcase",
    label: "Product Showcase",
    description: "Product footage/stills with feature callouts, comparisons and stat cards.",
    aspectRatio: "16:9",
    background: "mixed",
    sceneRange: [4, 6],
    favorOverlays: ["calloutBox", "statCard", "comparisonCard", "heroTitle", "providerChip"],
    keywords: ["product", "feature", "app", "device", "gadget", "saas", "tool", "showcase", "demo", "release", "hardware", "ecommerce", "shop"],
    guidance: `
VIDEO TYPE: Product Showcase.
Hero scenes use AI-generated product footage (background.kind "video", source
"generate", subject-anchored prompts of the product in use). Feature scenes may
use flat COLOR backgrounds. Overlays carry specifics: calloutBox for features,
statCard for numbers, comparisonCard for before/after. Open on a heroTitle, end
on a CTA card. Use scrim 0.35-0.5 only on the footage scenes; 0 on color scenes.
Beats: HERO SHOT -> FEATURE -> FEATURE -> BEFORE/AFTER -> CTA.`,
  },

  // -------------------------------------------------------------- explainer
  "explainer": {
    id: "explainer",
    label: "Explainer",
    description: "Step-by-step how-it-works with titles, callouts and progress. Mixed footage/color.",
    aspectRatio: "16:9",
    background: "mixed",
    sceneRange: [4, 6],
    favorOverlays: ["sectionTitle", "textCard", "calloutBox", "progressBar", "statReveal"],
    keywords: ["explainer", "how it works", "how-to", "howto", "tutorial", "step", "guide", "walkthrough", "onboarding", "teach", "learn", "process", "works"],
    guidance: `
VIDEO TYPE: How-it-works Explainer.
Walk through a process in clear STEPS. Each scene = one step, introduced by a
sectionTitle and explained with a textCard or calloutBox; use a progressBar to
show advancement and a statReveal for a key number. Backgrounds: simple AI
footage for context OR flat color — keep it clean and uncluttered. Scrim
0.35-0.5 on footage scenes, 0 on color. Beats: SETUP -> STEP 1 -> STEP 2 ->
STEP 3 -> RESULT.`,
  },

  // ------------------------------------------------------------- testimonial
  "testimonial": {
    id: "testimonial",
    label: "Testimonial",
    description: "Customer quotes and social proof over warm footage or color.",
    aspectRatio: "16:9",
    background: "mixed",
    sceneRange: [3, 5],
    favorOverlays: ["calloutBox", "textCard", "statCard", "providerChip", "heroTitle"],
    keywords: ["testimonial", "review", "quote", "customer", "feedback", "social proof", "client", "story", "praise", "rating"],
    guidance: `
VIDEO TYPE: Testimonial / Social Proof.
Each scene features ONE short customer quote (calloutBox or textCard) attributed
with a name (providerChip) over warm, human AI footage or a soft color. Sprinkle
a statCard for a result ("4.9 stars", "+30% sales"). Open with a heroTitle, end
on a CTA. Keep quotes punchy and believable. Scrim 0.4 on footage, 0 on color.
Beats: HOOK -> QUOTE 1 -> QUOTE 2 -> RESULT STAT -> CTA.`,
  },

  // ---------------------------------------------------------------- listicle
  "listicle": {
    id: "listicle",
    label: "Top List",
    description: "Countdown / top-N list with big reveals. Graphics, no footage cost.",
    aspectRatio: "16:9",
    background: "graphics",
    sceneRange: [4, 6],
    favorOverlays: ["statReveal", "sectionTitle", "textCard", "calloutBox", "particles"],
    keywords: ["top", "list", "listicle", "countdown", "ranking", "best", "tips", "reasons", "ways", "facts", "rank"],
    guidance: `
VIDEO TYPE: Top-N Listicle (graphics, NO AI footage).
A countdown of items. Backgrounds are bold flat COLOR (background.kind "color",
changing per scene; never source "generate"). Each scene reveals one list item
with a big number/statReveal + a sectionTitle and a one-line textCard. Energetic
and snappy. Set background.scrim to 0. Beats: TITLE ("Top 5...") -> #1 -> #2 ->
#3 -> WRAP/CTA.`,
  },

  // -------------------------------------------------------------- promo/sale
  "promo-sale": {
    id: "promo-sale",
    label: "Promo / Sale",
    description: "Urgent discount promo: big offer, price and CTA. Bold color or footage.",
    aspectRatio: "16:9",
    background: "mixed",
    sceneRange: [3, 5],
    favorOverlays: ["heroTitle", "statCard", "calloutBox", "comparisonCard", "providerChip"],
    keywords: ["sale", "discount", "promo", "offer", "deal", "coupon", "limited", "black friday", "clearance", "save", "off"],
    guidance: `
VIDEO TYPE: Promo / Sale.
High-urgency offer video. Lead with a heroTitle hook, slam the discount with a
big statCard ("50% OFF"), justify with a comparisonCard (was/now price), and end
on a strong calloutBox CTA with urgency ("Ends Sunday"). Mix punchy product AI
footage with bold flat-color offer cards. Scrim 0.4 on footage, 0 on color.
Beats: HOOK -> THE OFFER -> WAS/NOW -> URGENCY/CTA.`,
  },

  // ----------------------------------------------------------- subtitles
  "captions": {
    id: "captions",
    label: "Subtitles",
    description: "Big animated subtitles synced to the voiceover, over clean color. No footage.",
    aspectRatio: "16:9",
    background: "graphics",
    sceneRange: [3, 5],
    favorOverlays: ["sectionTitle"],
    keywords: ["subtitle", "subtitles", "caption", "captions", "captioned", "voiceover", "voice over", "lyric", "lyrics", "karaoke", "narration", "talking"],
    guidance: `
VIDEO TYPE: Subtitle / Captioned Voiceover (the WORDS are the video).
The auto-generated word-level captions synced to the narration are the MAIN
visual — they appear automatically, you do NOT add them. Backgrounds are clean
flat or gradient COLOR (background.kind "color", change per scene; never source
"generate" — no footage). Add NO overlays, or at most ONE small sectionTitle per
scene; do not clutter, the captions carry the message. Write a STRONG, clear
narration script — this video lives or dies on the voiceover. Set background.scrim
to 0. Keep scenes simple and let the spoken words pop. Beats: OPEN -> POINT ->
POINT -> CLOSE.`,
  },

  // ------------------------------------------------------------ social short
  "social-short": {
    id: "social-short",
    label: "Social Short (Vertical)",
    description: "9:16 fast-cut reel: big text, punchy footage or color, voiceover + captions.",
    aspectRatio: "9:16",
    background: "mixed",
    sceneRange: [3, 5],
    favorOverlays: ["heroTitle", "textCard", "statReveal", "calloutBox"],
    keywords: ["reel", "short", "tiktok", "shorts", "vertical", "social", "instagram", "story", "9:16", "viral"],
    guidance: `
VIDEO TYPE: Social Short (vertical 9:16, fast).
aspectRatio MUST be "9:16". Scenes are SHORT (3-4s) and punchy. Mix AI footage
hero scenes with bold flat-color text scenes. Big centered text overlays
(heroTitle / textCard) that read instantly on a phone. Keep narration snappy
(hook in the first scene). Use scrim 0.4 on footage scenes, 0 on color scenes.
Beats: SCROLL-STOP HOOK -> VALUE -> VALUE -> CTA.`,
  },
};

export const DEFAULT_RECIPE = "cinematic-ad";

/** List recipes for a UI picker (no guidance blob). */
export function listRecipes() {
  return Object.values(RECIPES).map(({ id, label, description, aspectRatio, background }) => ({
    id,
    label,
    description,
    aspectRatio,
    background,
  }));
}

/** Resolve a recipe by id, falling back to the default. */
export function getRecipe(id) {
  return RECIPES[id] || RECIPES[DEFAULT_RECIPE];
}

/**
 * Deterministically choose a recipe from the user's text (and target aspect).
 * Keyword scoring; vertical aspect biases toward the social short. This runs
 * with NO LLM call so selection is free and never fails.
 *
 * @param {string} userText
 * @param {{ aspectRatio?: string }} [opts]
 * @returns {Recipe}
 */
export function pickRecipe(userText, { aspectRatio } = {}) {
  const text = String(userText || "").toLowerCase();

  // A vertical canvas is a strong signal on its own.
  if (aspectRatio === "9:16") return RECIPES["social-short"];

  let best = RECIPES[DEFAULT_RECIPE];
  let bestScore = 0;
  for (const recipe of Object.values(RECIPES)) {
    let score = 0;
    for (const kw of recipe.keywords) {
      if (text.includes(kw)) score += kw.length >= 6 ? 2 : 1; // longer keywords are more specific
    }
    if (score > bestScore) {
      bestScore = score;
      best = recipe;
    }
  }
  return best;
}

/**
 * Render the recipe's instruction block for injection into the planner system
 * prompt. Returns "" for an unknown/empty recipe (backward compatible — the
 * planner then behaves exactly as before).
 *
 * @param {string|Recipe|null} recipeOrId
 * @returns {string}
 */
export function renderRecipeBlock(recipeOrId) {
  if (!recipeOrId) return "";
  const recipe = typeof recipeOrId === "string" ? RECIPES[recipeOrId] : recipeOrId;
  if (!recipe) return "";

  const [minScenes, maxScenes] = recipe.sceneRange;
  return [
    "RECIPE (follow this archetype exactly)",
    recipe.guidance.trim(),
    `Scene count: ${minScenes}-${maxScenes}. Default aspectRatio: "${recipe.aspectRatio}".`,
    `Favor these overlay types: ${recipe.favorOverlays.join(", ")}.`,
  ].join("\n");
}

export default RECIPES;
