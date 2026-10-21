import mongoose from "mongoose";

// Fail fast instead of letting mongoose sit on its 30s default
// server-selection timeout. A dead/unresolvable cluster should degrade the
// nested data, not stall the request that asked for it.
const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 5_000,
  socketTimeoutMS: 10_000,
} as const;

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return; // already connected
  await mongoose.connect(process.env.MONGODB_URI!, CONNECT_OPTIONS);
};

export default connectDB;
