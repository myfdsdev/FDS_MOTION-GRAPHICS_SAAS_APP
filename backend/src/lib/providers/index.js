// Unified LLM caller for the code-gen pipeline. Tries providers in priority
// order (Anthropic → OpenAI → OpenRouter → Gemini), using whichever API keys
// are present in the environment. Returns plain text (the model's full reply).
//
// This is intentionally env-key based and provider-agnostic so the Phase-1
// CLI and the worker can both use it without per-user key plumbing. Per-user
// keys can be layered on later.

import Anthropic from "@anthropic-ai/sdk";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Ordered list of configured providers, best-first. */
export function availableProviders() {
  const out = [];
  if (process.env.ANTHROPIC_API_KEY) {
    out.push({
      provider: "anthropic",
      key: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      premiumModel: process.env.ANTHROPIC_PREMIUM_MODEL || "claude-opus-4-8",
    });
  }
  if (process.env.OPENAI_API_KEY) {
    out.push({
      provider: "openai",
      key: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o",
      premiumModel: process.env.OPENAI_PREMIUM_MODEL || "gpt-4o",
    });
  }
  if (process.env.OPENROUTER_API_KEY) {
    out.push({
      provider: "openrouter",
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
      premiumModel: process.env.OPENROUTER_PREMIUM_MODEL || "anthropic/claude-3.5-sonnet",
    });
  }
  if (process.env.GEMINI_API_KEY) {
    out.push({
      provider: "gemini",
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      premiumModel: process.env.GEMINI_PREMIUM_MODEL || "gemini-2.0-flash",
    });
  }
  return out;
}

export function hasAnyProvider() {
  return availableProviders().length > 0;
}

/**
 * Call the LLM with a system + user message and return the text reply.
 * Walks the provider list until one succeeds.
 *
 * @param {object} o
 * @param {string} o.system      system prompt
 * @param {string} o.user        user message
 * @param {boolean} [o.premium]  use the premium model where available
 * @param {number} [o.maxTokens] cap on output tokens (default 8000 — components are long)
 */
export async function callLLM({ system, user, premium = false, maxTokens = 8000 }) {
  const providers = availableProviders();
  if (!providers.length) {
    throw new Error(
      "No LLM provider configured. Set ANTHROPIC_API_KEY (recommended) or OPENAI_API_KEY / OPENROUTER_API_KEY / GEMINI_API_KEY in backend/.env."
    );
  }
  let lastErr;
  for (const p of providers) {
    try {
      const model = premium ? p.premiumModel : p.model;
      if (p.provider === "anthropic") return await callAnthropic(p.key, model, system, user, maxTokens);
      if (p.provider === "gemini") return await callGemini(p.key, model, system, user, maxTokens);
      return await callOpenAICompatible(p, model, system, user, maxTokens);
    } catch (err) {
      lastErr = err;
      console.warn(`[providers] ${p.provider} failed: ${err?.message || err}. Trying next…`);
    }
  }
  throw lastErr || new Error("All LLM providers failed");
}

async function callAnthropic(key, model, system, user, maxTokens) {
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = (msg.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text) throw new Error("Anthropic returned empty response");
  return text;
}

async function callOpenAICompatible(p, model, system, user, maxTokens) {
  const url = p.provider === "openrouter" ? OPENROUTER_URL : OPENAI_URL;
  const headers = {
    Authorization: `Bearer ${p.key}`,
    "Content-Type": "application/json",
  };
  if (p.provider === "openrouter") {
    headers["HTTP-Referer"] = process.env.WEB_ORIGIN || "http://localhost:5173";
    headers["X-Title"] = "AI Video Generator";
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${p.provider} (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${p.provider} returned empty response`);
  return text;
}

async function callGemini(key, model, system, user, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`gemini (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((x) => x.text).join("") || "";
  if (!text) throw new Error("gemini returned empty response");
  return text;
}
