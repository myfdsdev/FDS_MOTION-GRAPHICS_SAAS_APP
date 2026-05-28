import "dotenv/config";
import { createApp } from "./src/app.js";
import { connectDB } from "./src/db.js";

async function main() {
  await connectDB();
  const app = createApp();
  const PORT = Number(process.env.PORT) || 3001;
  app.listen(PORT, () => console.log(`API listening on :${PORT}`));

  // INLINE_WORKER=true runs the Remotion render loop inside this process, so a
  // single `npm run dev` does everything. In production keep it off and run the
  // standalone worker (`npm run worker`) as its own service.
  if (process.env.INLINE_WORKER === "true") {
    console.log("[api] INLINE_WORKER enabled — starting render loop in-process…");
    const { startWorker } = await import("./worker.js");
    startWorker().catch((err) => console.error("[api] inline worker crashed:", err));
  }
}

main().catch((err) => {
  console.error("[api] failed to start:", err);
  process.exit(1);
});
