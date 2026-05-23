import "dotenv/config";
import { createApp } from "./src/app.js";
import { connectDB } from "./src/db.js";

async function main() {
  await connectDB();
  const app = createApp();
  const PORT = Number(process.env.PORT) || 3001;
  app.listen(PORT, () => console.log(`API listening on :${PORT}`));
}

main().catch((err) => {
  console.error("[api] failed to start:", err);
  process.exit(1);
});
