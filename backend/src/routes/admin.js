import { Router } from "express";
import { CreditTx, Project, User } from "../models.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { toProjectDTO, toUserDTO } from "../serialize.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/overview", async (_req, res, next) => {
  try {
    const [
      users,
      projects,
      doneProjects,
      failedProjects,
      runningProjects,
      creditTxs,
      recentUsers,
      recentProjects,
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
    ]);

    const creditsIssued = creditTxs
      .filter((tx) => tx.delta > 0)
      .reduce((sum, tx) => sum + tx.delta, 0);
    const creditsSpent = creditTxs
      .filter((tx) => tx.delta < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.delta), 0);

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
      recentUsers: recentUsers.map(toUserDTO),
      recentProjects: recentProjects.map(toProjectDTO),
    });
  } catch (err) {
    next(err);
  }
});
