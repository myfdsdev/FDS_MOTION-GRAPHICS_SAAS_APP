import "dotenv/config";
import argon2 from "argon2";
import { connectDB, disconnectDB } from "./db.js";
import { CreditTx, Project, Session, User } from "./models.js";

const RESET = process.argv.includes("--reset");

async function main() {
  await connectDB();

  if (RESET) {
    await Promise.all([
      User.deleteMany({}),
      Session.deleteMany({}),
      Project.deleteMany({}),
      CreditTx.deleteMany({}),
    ]);
    console.log("[seed] cleared all collections");
  }

  const email = "demo@aivideo.app";
  const existing = await User.findOne({ email });
  if (existing && !RESET) {
    console.log(`[seed] demo user already exists (${email})`);
  } else {
    const passwordHash = await argon2.hash("password123");
    const user = await User.create({ email, name: "Demo Creator", passwordHash, credits: 30 });
    await CreditTx.create({ userId: user._id, delta: 30, reason: "signup_bonus" });
    console.log(`[seed] created demo user ${email} / password123 (30 credits)`);
  }

  await disconnectDB();
  console.log("[seed] done");
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
