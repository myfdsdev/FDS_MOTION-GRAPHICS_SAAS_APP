// ElevenLabs TTS provider — REAL, synchronous text-to-speech. Unlike the
// queue-based aggregators, ElevenLabs returns the audio bytes directly, so
// `submit` does the work (calls the API, writes a real .mp3 to public/tts) and
// `poll` just returns the stored result. This is the one media-gen path that
// works today with the key already in .env — no fal/kie purchase needed.

import fs from "node:fs";
import path from "node:path";
import { CAPABILITY } from "../capabilities.js";

const API_BASE = "https://api.elevenlabs.io/v1/text-to-speech";
const OUT_DIR = path.resolve("public", "tts");

function key() {
  return process.env.ELEVENLABS_API_KEY || "";
}
function defaultVoice() {
  return process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel (free stock)
}
function model() {
  return process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
}

const results = new Map();

export const elevenlabsProvider = {
  name: "elevenlabs",
  supports: new Set([CAPABILITY.TEXT_TO_SPEECH]),

  available() {
    return Boolean(key());
  },

  async submit(_capability, params = {}) {
    const voice = params.voiceId || params.voice || defaultVoice();
    const res = await fetch(`${API_BASE}/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": key(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text: params.text, model_id: model() }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`elevenlabs (${res.status}): ${body.slice(0, 240)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const id = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const file = path.join(OUT_DIR, `${id}.mp3`);
    fs.writeFileSync(file, buf);

    results.set(id, {
      kind: "audio",
      url: `/tts/${id}.mp3`,
      path: file,
      mimeType: "audio/mpeg",
      bytes: buf.length,
    });
    return { jobId: id };
  },

  async poll(jobId) {
    const r = results.get(jobId);
    if (!r) return { status: "failed", error: `unknown elevenlabs job: ${jobId}` };
    results.delete(jobId);
    return { status: "done", assets: [r] };
  },
};
