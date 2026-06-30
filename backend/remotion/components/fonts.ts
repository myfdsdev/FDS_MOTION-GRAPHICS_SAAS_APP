// Loads the display font ONCE for all premium components. Importing this module
// triggers the @remotion/google-fonts load so the font is embedded in the render
// (no more system fallback). Used by KineticTitle / LogoReveal.
import { loadFont } from "@remotion/google-fonts/SpaceGrotesk";

const { fontFamily } = loadFont("normal", { weights: ["500", "700"] });

export const DISPLAY_FONT = `${fontFamily}, Inter, system-ui, sans-serif`;
