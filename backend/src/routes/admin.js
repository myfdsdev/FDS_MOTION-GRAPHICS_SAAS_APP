import { Router } from "express";
import { ApiUsage, CreditTx, Project, User } from "../models.js";
import { apiUsageMonthlyTokenLimit } from "../lib/apiUsage.js";
import { getAppSettings, updateAppSettings } from "../lib/settings.js";
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
