// Unified LLM caller for the code-gen pipeline. Tries providers in priority
// order (Anthropic → OpenAI → OpenRouter → Gemini), using whichever API keys
// are present in the environment. Returns plain text (the model's full reply).
//
// This is intentionally env-key based and provider-agnostic so the Phase-1
// CLI and the worker can both use it without per-user key plumbing. Per-user
// keys can be layered on later.

import Anthropic from "@anthropic-ai/sdk";
import { getProviderKey } from "../providerKeys.js";
import { getModel } from "../providerModels.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Ordered list of configured providers, best-first. Keys resolve from the
 *  admin panel (DB) first, then .env — see lib/providerKeys.js. */
export function availableProviders() {
  const out = [];
  const anthropicKey = getProviderKey("anthropic");
  if (anthropicKey) {
    out.push({
      provider: "anthropic",
      key: anthropicKey,
      model: getModel("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
      premiumModel: process.env.ANTHROPIC_PREMIUM_MODEL || "claude-opus-4-8",
    });
  }
  const openaiKey = getProviderKey("openai");
  if (openaiKey) {
    out.push({
      provider: "openai",
      key: openaiKey,
      model: getModel("OPENAI_MODEL", "gpt-4o"),
      premiumModel: process.env.OPENAI_PREMIUM_MODEL || "gpt-4o",
    });
  }
  const openrouterKey = getProviderKey("openrouter");
  if (openrouterKey) {
    out.push({
      provider: "openrouter",
      key: openrouterKey,
      model: getModel("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet"),
      premiumModel: process.env.OPENROUTER_PREMIUM_MODEL || "anthropic/claude-3.5-sonnet",
    });
  }
  const geminiKey = getProviderKey("gemini");
  if (geminiKey) {
    out.push({
      provider: "gemini",
      key: geminiKey,
      model: getModel("GEMINI_MODEL", "gemini-2.0-flash"),
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
    const model = premium ? p.premiumModel : p.model;
    const attempt = () => {
      if (p.provider === "anthropic") return callAnthropic(p.key, model, system, user, maxTokens);
      if (p.provider === "gemini") return callGemini(p.key, model, system, user, maxTokens);
      return callOpenAICompatible(p, model, system, user, maxTokens);
    };
    try {
      return await withRetry(attempt, p.provider);
    } catch (err) {
      lastErr = err;
      console.warn(`[providers] ${p.provider} exhausted: ${err?.message || err}. Trying next provider…`);
    }
  }
  throw lastErr || new Error("All LLM providers failed");
}

// Retry a single provider on transient errors (429 rate-limit, 5xx overload).
// Permanent errors (401/403/400) fail fast so we fall through to the next
// provider immediately.
async function withRetry(fn, label, tries = 4, baseDelay = 2500) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const m = msg.match(/\((\d{3})\)/);
      const code = m ? Number(m[1]) : null;
      const transient = code === 429 || code === 408 || (code !== null && code >= 500) || code === null;
      if (!transient || i === tries - 1) break;
      const delay = Math.round(baseDelay * Math.pow(2, i) * (0.7 + Math.random() * 0.6));
      console.warn(`[providers] ${label} ${code ?? "?"} — retry ${i + 1}/${tries - 1} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
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
