import mongoose from "mongoose";

// Fail fast instead of letting mongoose sit on its 30s default
// server-selection timeout. A dead/unresolvable cluster should degrade the
// nested data, not stall the request that asked for it.
const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 5_000,
  socketTimeoutMS: 10_000,
} as const;

// A cluster that is reachable but rejects the credentials (bad password,
// user not provisioned for this cluster) fails the handshake in ~1.3s.
// Without a cooldown every Mongo call in a request path pays that cost.
// Back off briefly, then try again so a corrected configuration recovers
// on its own without a redeploy.
const FAILURE_COOLDOWN_MS = 30_000;

let lastFailureAt = 0;
let lastFailureMessage = "";

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return; // already connected

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set - add it to .env.local");
  }
  if (uri.includes("<db_password>") || uri.includes("YOUR_MONGODB_PASS")) {
    throw new Error(
      "MONGODB_URI still contains the placeholder password - replace <db_password> with the real Atlas password in .env.local"
    );
  }

  if (lastFailureAt && Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) {
    throw new Error(lastFailureMessage);
  }

  try {
    await mongoose.connect(uri, CONNECT_OPTIONS);
    lastFailureAt = 0;
    lastFailureMessage = "";
  } catch (error) {
    lastFailureAt = Date.now();
    lastFailureMessage = error instanceof Error ? error.message : String(error);
    throw error;
  }
};

export default connectDB;

/**
 * Keep the Atlas cluster alive.
 *
 * Atlas terminates a cluster that has had no connections for ~30 days
 * (free M0 clusters especially), and the nested game data - characters,
 * maps, items - lives only in MongoDB. Neon cannot restore it because it
 * never stored it. A periodic ping keeps a connection open so the cluster
 * is not reclaimed.
 *
 * Never throws: a failed heartbeat must not break the worker loop.
 */
export async function keepMongoAlive(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState < 1) {
      await connectDB();
    }
    const db = mongoose.connection.db;
    if (!db) return false;
    await db.admin().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
