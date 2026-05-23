import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { loadUser } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { adminRouter } from "./routes/admin.js";
import { assetsRouter } from "./routes/assets.js";
import { authRouter } from "./routes/auth.js";
import { billingRouter } from "./routes/billing.js";
import { enhanceRouter } from "./routes/enhance.js";
import { profileRouter } from "./routes/profile.js";
import { projectsRouter } from "./routes/projects.js";
import { stripeRouter, stripeWebhookHandler } from "./routes/stripe.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = path.join(__dirname, "..", "public", "videos");

export function createApp() {
  const app = express();

  // Stripe webhook needs the raw body, so mount it BEFORE express.json().
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhookHandler
  );

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.WEB_ORIGIN || "http://localhost:3000",
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  app.use(loadUser);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Serve rendered MP4s. helmet defaults CORP to same-origin, which would block
  // the frontend (different port) from loading the <video>, relax it here.
  app.use(
    "/videos",
    (_req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    },
    express.static(VIDEOS_DIR)
  );

  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/enhance-prompt", enhanceRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/stripe", stripeRouter);
  app.use("/api/assets", assetsRouter);

  app.use(errorHandler);

  return app;
}
