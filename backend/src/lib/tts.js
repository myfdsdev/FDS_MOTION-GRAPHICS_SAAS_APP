// ElevenLabs text-to-speech.
//
// The API key is read once at call time from process.env.ELEVENLABS_API_KEY
// (set in backend .env) and is NEVER logged, returned, or exposed to clients.
// The default voice is configurable via ELEVENLABS_VOICE_ID; falls back to
// "Rachel" (21m00Tcm4TlvDq8ikWAM) — a clear, neutral English narrator.

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL = "eleven_multilingual_v2";
const TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

export function isTtsConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

/**
 * Synthesize a narration MP3 from text. Returns a Node Buffer of MP3 bytes.
 * Throws on missing key or non-2xx response — callers should treat TTS as
 * additive and continue without it if this throws.
 */
export async function synthesizeVoiceover(text, voiceId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  const voice = voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const body = {
    text: String(text || "").trim(),
    model_id: DEFAULT_MODEL,
    voice_settings: { stability: 0.45, similarity_boost: 0.75 },
  };

  if (!body.text) throw new Error("Voiceover script is empty");

  const res = await fetch(`${TTS_URL}/${encodeURIComponent(voice)}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      accept: "audio/mpeg",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Deliberately do NOT include the key or full request body in the error.
    throw new Error(
      `ElevenLabs TTS failed (${res.status}): ${text.slice(0, 300) || res.statusText}`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Rough duration estimate from raw text — ~160 words per minute.
 * Used because pulling MP3 duration cheaply needs a parser/ffprobe we don't
 * have in this process. The user can drag/trim on the timeline to fine-tune.
 */
export function estimateVoiceoverDuration(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 0;
  return Math.max(1, Math.round((words * 60) / 160));
}
