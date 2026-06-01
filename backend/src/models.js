import mongoose from "mongoose";

const { Schema } = mongoose;

export const PROJECT_STATUSES = [
  "PLANNING",
  "GENERATING_ASSETS",
  // Plan has been generated/saved; the user is editing. Worker does NOT
  // auto-claim this state — rendering happens only on explicit user action.
  "READY_TO_EDIT",
  "QUEUED",
  "RENDERING",
  "DONE",
  "FAILED",
];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: null },
    passwordHash: { type: String, required: true },
    credits: { type: Number, default: 30 },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    apiKeys: {
      openai: { type: String, default: null },
      gemini: { type: String, default: null },
      fal: { type: String, default: null },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const sessionSchema = new Schema(
  {
    _id: { type: String, required: true }, // 32-byte random hex
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: false }
);

const projectSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    prompt: { type: String, required: true },
    status: { type: String, enum: PROJECT_STATUSES, default: "PLANNING" },
    script: { type: String, default: null },
    sceneJson: { type: Schema.Types.Mixed, default: null },
    template: { type: String, default: null },
    aspectRatio: { type: String, default: "16:9" },
    durationSec: { type: Number, default: 20 },
    outputUrl: { type: String, default: null },
    thumbnailUrl: { type: String, default: null },
    /** Narration MP3 produced by ElevenLabs TTS from `script`. Optional. */
    voiceoverUrl: { type: String, default: null },
    voiceoverDuration: { type: Number, default: null },
    /** Short reason TTS produced no narration (or null on success). */
    voiceoverError: { type: String, default: null },
    progress: { type: Number, default: 0 },
    errorMessage: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
projectSchema.index({ userId: 1, createdAt: -1 });

const assetSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    kind: { type: String, required: true }, // logo | product | background | icon | generated
    url: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const creditTxSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    delta: { type: Number, required: true },
    reason: { type: String, required: true },
    projectId: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
creditTxSchema.index({ userId: 1, createdAt: -1 });

const apiUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    provider: { type: String, enum: ["openai", "gemini"], required: true, index: true },
    keySource: { type: String, enum: ["user", "environment"], required: true },
    purpose: {
      type: String,
      enum: ["video_generation", "prompt_enhancement"],
      required: true,
    },
    model: { type: String, default: null },
    requestCount: { type: Number, default: 1 },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
apiUsageSchema.index({ createdAt: -1 });

const appSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const lottieAssetSchema = new Schema(
  {
    assetId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/,
    },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    // Free-form so admins can add their own categories (e.g. "healthcare").
    category: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 40,
    },
    tags: { type: [String], default: [] },
    animationData: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);
lottieAssetSchema.index({ category: 1, createdAt: -1 });

// Guard against model re-compilation under `node --watch` reloads.
export const User = mongoose.models.User || mongoose.model("User", userSchema);
export const Session = mongoose.models.Session || mongoose.model("Session", sessionSchema);
export const Project = mongoose.models.Project || mongoose.model("Project", projectSchema);
export const Asset = mongoose.models.Asset || mongoose.model("Asset", assetSchema);
export const CreditTx = mongoose.models.CreditTx || mongoose.model("CreditTx", creditTxSchema);
export const ApiUsage = mongoose.models.ApiUsage || mongoose.model("ApiUsage", apiUsageSchema);
export const AppSetting =
  mongoose.models.AppSetting || mongoose.model("AppSetting", appSettingSchema);
export const LottieAsset =
  mongoose.models.LottieAsset || mongoose.model("LottieAsset", lottieAssetSchema);
