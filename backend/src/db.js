import mongoose from "mongoose";

let memoryServer = null;
let connected = false;

async function resolveUri() {
  if (process.env.USE_MEMORY_DB === "true") {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    const uri = memoryServer.getUri();
    console.log(`[db] started in-memory MongoDB at ${uri}`);
    return uri;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Set it to a MongoDB connection string, or set USE_MEMORY_DB=true."
    );
  }
  return uri;
}

export async function connectDB() {
  if (connected) return mongoose;
  const uri = await resolveUri();
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  connected = true;
  console.log("[db] connected");
  return mongoose;
}

export async function disconnectDB() {
  if (!connected) return;
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
  connected = false;
}
