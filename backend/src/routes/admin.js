import { Router } from "express";
import { ApiUsage, CreditTx, Project, User } from "../models.js";
import { apiUsageMonthlyTokenLimit } from "../lib/apiUsage.js";
import { getAppSettings, updateAppSettings } from "../lib/settings.js";
import { providerKeySummaries, setProviderKeys, PROVIDERS } from "../lib/providerKeys.js";
import { providerModelSummaries, setProviderModels, MODEL_SETTINGS } from "../lib/providerModels.js";
import { getProvidersConfig, setProvidersConfig } from "../lib/providersConfig.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { UpdateAdminSettingsInput } from "../schemas.js";
import { toProjectDTO, toUserDTO } from "../serialize.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/overview", async (_req, res, next) => {
  try {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const usageMatch = { createdAt: { $gte: periodStart, $lte: now } };

    const [
      users,
      projects,
      doneProjects,
      failedProjects,
      runningProjects,
      creditTxs,
      recentUsers,
      recentProjects,
      apiUsageTotals,
      apiUsageByProvider,
      lastApiUsage,
      settings,
    ] = await Promise.all([
      User.countDocuments(),
      Project.countDocuments({ deletedAt: null }),
      Project.countDocuments({ deletedAt: null, status: "DONE" }),
      Project.countDocuments({ deletedAt: null, status: "FAILED" }),
      Project.countDocuments({
        deletedAt: null,
        status: { $in: ["PLANNING", "GENERATING_ASSETS", "QUEUED", "RENDERING"] },
      }),
      CreditTx.find().lean(),
      User.find().sort({ createdAt: -1 }).limit(8).lean(),
      Project.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(8).lean(),
      ApiUsage.aggregate([
        { $match: usageMatch },
        {
          $group: {
            _id: null,
            requests: { $sum: "$requestCount" },
            inputTokens: { $sum: "$inputTokens" },
            outputTokens: { $sum: "$outputTokens" },
            totalTokens: { $sum: "$totalTokens" },
          },
        },
      ]),
      ApiUsage.aggregate([
        { $match: usageMatch },
        {
          $group: {
            _id: { provider: "$provider", keySource: "$keySource" },
            requests: { $sum: "$requestCount" },
            totalTokens: { $sum: "$totalTokens" },
          },
        },
        { $sort: { totalTokens: -1 } },
      ]),
      ApiUsage.findOne().sort({ createdAt: -1 }).lean(),
      getAppSettings(),
    ]);

    const creditsIssued = creditTxs
      .filter((tx) => tx.delta > 0)
      .reduce((sum, tx) => sum + tx.delta, 0);
    const creditsSpent = creditTxs
      .filter((tx) => tx.delta < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.delta), 0);
    const usageTotals = apiUsageTotals[0] || {};
    const monthlyTokenLimit = apiUsageMonthlyTokenLimit();
    const totalTokens = usageTotals.totalTokens || 0;

    res.json({
      stats: {
        users,
        projects,
        doneProjects,
        failedProjects,
        runningProjects,
        creditsIssued,
        creditsSpent,
      },
      apiUsage: {
        periodStart: periodStart.toISOString(),
        periodEnd: now.toISOString(),
        monthlyTokenLimit,
        percentOfLimit:
          monthlyTokenLimit > 0
            ? Math.min(100, Math.round((totalTokens / monthlyTokenLimit) * 100))
            : 0,
        totalRequests: usageTotals.requests || 0,
        inputTokens: usageTotals.inputTokens || 0,
        outputTokens: usageTotals.outputTokens || 0,
        totalTokens,
        lastUsedAt: lastApiUsage?.createdAt?.toISOString?.() || null,
        byProvider: apiUsageByProvider.map((row) => ({
          provider: row._id.provider,
          keySource: row._id.keySource,
          requests: row.requests,
          totalTokens: row.totalTokens,
        })),
      },
      settings,
      recentUsers: recentUsers.map(toUserDTO),
      recentProjects: recentProjects.map(toProjectDTO),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/settings", validate(UpdateAdminSettingsInput), async (req, res, next) => {
  try {
    const settings = await updateAppSettings(req.body);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// --- Provider API keys (admin-managed; encrypted at rest) -----------------

// Safe summaries only — never returns raw keys.
adminRouter.get("/provider-keys", async (_req, res, next) => {
  try {
    res.json({ providers: providerKeySummaries() });
  } catch (err) {
    next(err);
  }
});

// Save keys. Body: { keys: { <providerId>: "<value or empty to clear>" } }.
adminRouter.put("/provider-keys", async (req, res, next) => {
  try {
    const keys = req.body?.keys;
    if (!keys || typeof keys !== "object" || Array.isArray(keys)) {
      return res.status(400).json({ error: "Body must be { keys: { providerId: value } }" });
    }
    const known = new Set(PROVIDERS.map((p) => p.id));
    const bad = Object.keys(keys).filter((k) => !known.has(k));
    if (bad.length) {
      return res.status(400).json({ error: `Unknown provider(s): ${bad.join(", ")}` });
    }
    const providers = await setProviderKeys(keys);
    res.json({ providers });
  } catch (err) {
    next(err);
  }
});

// --- Provider models (admin-managed; which model each provider uses) -------

adminRouter.get("/provider-models", async (_req, res, next) => {
  try {
    res.json({ models: providerModelSummaries() });
  } catch (err) {
    next(err);
  }
});

// Body: { models: { <settingId>: "<model slug or empty to reset>" } }
adminRouter.put("/provider-models", async (req, res, next) => {
  try {
    const models = req.body?.models;
    if (!models || typeof models !== "object" || Array.isArray(models)) {
      return res.status(400).json({ error: "Body must be { models: { settingId: value } }" });
    }
    const known = new Set(MODEL_SETTINGS.map((m) => m.id));
    const bad = Object.keys(models).filter((k) => !known.has(k));
    if (bad.length) {
      return res.status(400).json({ error: `Unknown model setting(s): ${bad.join(", ")}` });
    }
    const updated = await setProviderModels(models);
    res.json({ models: updated });
  } catch (err) {
    next(err);
  }
});

// --- Providers config (per-model enable/disable from the Providers manager) --

adminRouter.get("/providers-config", async (_req, res, next) => {
  try {
    res.json(getProvidersConfig());
  } catch (err) {
    next(err);
  }
});

// Body: { enabledModels: { "<provider>:<model>": boolean } }
adminRouter.put("/providers-config", async (req, res, next) => {
  try {
    const enabledModels = req.body?.enabledModels;
    if (enabledModels && (typeof enabledModels !== "object" || Array.isArray(enabledModels))) {
      return res.status(400).json({ error: "enabledModels must be an object map" });
    }
    const updated = await setProvidersConfig({ enabledModels: enabledModels || {} });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Lottie admin endpoints removed — the Lottie subsystem was part of the old
// JSON-template architecture and is gone under code-gen.
