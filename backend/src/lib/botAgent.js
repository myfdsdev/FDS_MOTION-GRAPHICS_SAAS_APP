// botAgent — the agent executor for the Bot Engine.
//
// callLLM returns plain text (no native function-calling), so we use a JSON
// tool-call PROTOCOL: the model must answer with exactly one JSON object —
// either a tool call ({"tool":"create_video","args":{...}}) or a chat reply
// ({"reply":"..."}). The route parses it and runs the tool (which reuses the
// existing Project generation pipeline) or posts the reply.
//
// Adding a tool = add it to TOOLS + the prompt, and handle it in routes/bot.js.

import { callLLM, hasAnyProvider } from "./providers/index.js";

export const AGENT_NAME = "Mosaic";

const SYSTEM_PROMPT = `You are ${AGENT_NAME}, a warm, concise AI assistant inside a video-creation app. You can CHAT with the user and you can CREATE videos for them.

You have ONE tool:
- create_video: generate a video from a description.
  args: { "prompt": string (a rich, vivid description of the video), "durationSec": number 5-60 (default 20), "aspectRatio": "16:9" | "9:16" | "1:1" (default "16:9") }

DECIDE each turn:
- If the user wants you to MAKE / CREATE / GENERATE / "do" a video (ad, intro, explainer, reel, promo, logo animation, etc.), CALL THE TOOL. Expand their idea into a strong prompt yourself.
- Otherwise (questions, greetings, refining an idea, feedback), just REPLY.

OUTPUT FORMAT — respond with EXACTLY ONE JSON object and nothing else:
- To create a video: {"tool":"create_video","args":{"prompt":"...","durationSec":20,"aspectRatio":"16:9"}}
- To chat: {"reply":"<your message in GitHub-flavored markdown>"}

Rules:
- Never mention how videos are built internally, code, components, or any rendering engine.
- Keep chat replies friendly and under ~80 words unless asked for detail.
- Output valid JSON only. No markdown fences around the JSON. No extra text.`;

const ASPECTS = new Set(["16:9", "9:16", "1:1", "4:3"]);

function extractJson(raw) {
  const s = String(raw || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clampDuration(v) {
  const n = Math.round(Number(v) || 20);
  return Math.max(5, Math.min(60, n));
}

/**
 * Run one agent turn over the conversation so far.
 *
 * @param {Array<{role:"user"|"assistant",content:string}>} history
 * @returns {Promise<{kind:"tool",tool:string,args:object} | {kind:"text",text:string}>}
 */
export async function runAgent(history) {
  if (!hasAnyProvider()) {
    return {
      kind: "text",
      text: "I'm not connected to an AI provider yet. Add an API key in **Admin → Providers** (or the backend `.env`) and I'll be able to chat and make videos.",
    };
  }

  const convo = history
    .filter((m) => m && m.content)
    .slice(-20) // keep context bounded
    .map((m) => `${m.role === "assistant" ? AGENT_NAME.toUpperCase() : "USER"}: ${m.content}`)
    .join("\n");

  let raw;
  try {
    raw = await callLLM({ system: SYSTEM_PROMPT, user: convo, maxTokens: 900 });
  } catch (err) {
    return { kind: "text", text: `Sorry — I hit an error reaching the AI (${err?.message || "unknown"}). Try again in a moment.` };
  }

  const obj = extractJson(raw);

  if (obj?.tool === "create_video" && obj.args?.prompt) {
    const a = obj.args;
    const aspectRatio = ASPECTS.has(a.aspectRatio) ? a.aspectRatio : "16:9";
    return {
      kind: "tool",
      tool: "create_video",
      args: {
        prompt: String(a.prompt).trim(),
        durationSec: clampDuration(a.durationSec),
        aspectRatio,
        recipe: typeof a.recipe === "string" ? a.recipe : "auto",
      },
    };
  }

  if (obj?.reply) return { kind: "text", text: String(obj.reply).trim() };

  // Fallback: the model ignored the JSON contract — treat the raw text as chat.
  const text = String(raw || "").trim().replace(/^```(?:json|text)?\s*|\s*```$/g, "");
  return { kind: "text", text: text || "I didn't catch that — could you rephrase?" };
}
