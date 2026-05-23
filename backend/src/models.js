import mongoose from "mongoose";

const { Schema } = mongoose;

export const PROJECT_STATUSES = [
  "PLANNING",
  "GENERATING_ASSETS",
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

// Guard against model re-compilation under `node --watch` reloads.
export const User = mongoose.models.User || mongoose.model("User", userSchema);
export const Session = mongoose.models.Session || mongoose.model("Session", sessionSchema);
export const Project = mongoose.models.Project || mongoose.model("Project", projectSchema);
export const Asset = mongoose.models.Asset || mongoose.model("Asset", assetSchema);
export const CreditTx = mongoose.models.CreditTx || mongoose.model("CreditTx", creditTxSchema);
