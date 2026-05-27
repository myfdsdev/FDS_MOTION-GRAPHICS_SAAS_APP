import { ApiUsage } from "../models.js";

const DEFAULT_MONTHLY_TOKEN_LIMIT = 1_000_000;

function positiveInt(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number);
}

export function apiUsageMonthlyTokenLimit() {
  const configured = positiveInt(process.env.API_USAGE_MONTHLY_TOKEN_LIMIT);
  return configured || DEFAULT_MONTHLY_TOKEN_LIMIT;
}

export function usageFromOpenAI(usage = {}) {
  return {
    inputTokens: positiveInt(usage.prompt_tokens),
    outputTokens: positiveInt(usage.completion_tokens),
    totalTokens: positiveInt(usage.total_tokens),
  };
}

export function usageFromGemini(usage = {}) {
  return {
    inputTokens: positiveInt(usage.promptTokenCount),
    outputTokens: positiveInt(usage.candidatesTokenCount),
    totalTokens: positiveInt(usage.totalTokenCount),
  };
}

export async function recordApiUsage({ userId, config, purpose, usage }) {
  if (!config?.provider) return;

  const inputTokens = positiveInt(usage?.inputTokens);
  const outputTokens = positiveInt(usage?.outputTokens);
  const fallbackTotal = inputTokens + outputTokens;
  const totalTokens = positiveInt(usage?.totalTokens) || fallbackTotal;

  try {
    await ApiUsage.create({
      userId: userId || null,
      provider: config.provider,
      keySource: config.keySource || "environment",
      purpose,
      model: config.model || null,
      requestCount: 1,
      inputTokens,
      outputTokens,
      totalTokens,
    });
  } catch (err) {
    console.error("[api-usage] failed to record usage:", err);
  }
}
