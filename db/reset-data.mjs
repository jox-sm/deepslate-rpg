/**
 * Reset every datastore to a clean pre-launch state.
 *
 * Wipes, in order:
 *   1. Neon/PostgreSQL  - the `games` table (row-level game data)
 *   2. MongoDB          - the `games` collection (nested characters/maps/items)
 *   3. Upstash Redis    - game cache, hotness cache, pending likes,
 *                         idempotency records and the async queues
 *
 * Safe by default: it only reports what it WOULD delete. Pass --yes to
 * actually wipe. If any store cannot be reached it aborts before touching
 * anything, so you never end up with a half-wiped system.
 *
 * Usage:
 *   node --env-file=.env --env-file=.env.local db/reset-data.mjs          # dry run
 *   node --env-file=.env --env-file=.env.local db/reset-data.mjs --yes    # wipe
 *
 * Stop the dev server first - the background workers would immediately
 * re-prime the cache and re-queue work while you are wiping.
 */

import { MongoClient } from "mongodb";
import { neon } from "@neondatabase/serverless";
import { Redis } from "@upstash/redis";

const CONFIRM = process.argv.includes("--yes");

const uri = process.env.MONGODB_URI;
const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const missing = [];
if (!uri) missing.push("MONGODB_URI");
if (!databaseUrl) missing.push("DATABASE_URL");
if (!redisUrl) missing.push("UPSTASH_REDIS_REST_URL");
if (!redisToken) missing.push("UPSTASH_REDIS_REST_TOKEN");
if (missing.length) {
  console.error(`Missing environment variable(s): ${missing.join(", ")}`);
  process.exit(1);
}
if (uri.includes("<db_password>") || uri.includes("YOUR_MONGODB_PASS")) {
  console.error("MONGODB_URI still contains a placeholder password");
  process.exit(1);
}

// Every Redis key the app owns. Anything not matching these is left alone.
const REDIS_PATTERNS = [
  "game:*", // cached game rows, game:ids:all index, game:hotness:*, game:fetch:*
  "cache:*", // cache:primed:games, cache:views:array, cache:data:array, ...
  "likes:*", // pending like deltas
  "idempotency:*", // request idempotency records
  "InsertGames*", // neon games queue + :processing: temp keys
  "InsertLikes*", // neon likes queue + :processing: temp keys
  "InsertGamesmongodb*", // mongodb games queue
  "InsertLikesmongodb*", // mongodb likes queue
];

const redis = new Redis({ url: redisUrl, token: redisToken, retry: false });
const sql = neon(databaseUrl);

async function main() {
  console.log(CONFIRM ? "RESET (destructive)" : "DRY RUN - nothing will be deleted");
  console.log("=".repeat(60));

  // --- reach every store before deleting anything -------------------------
  const mongo = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  try {
    await mongo.connect();
  } catch (error) {
    console.error(`\nMongoDB unreachable: ${error.message}`);
    console.error("Aborting before making any changes.");
    process.exit(1);
  }

  try {
    await redis.ping();
  } catch (error) {
    console.error(`\nRedis unreachable: ${error.message}`);
    console.error("Aborting before making any changes.");
    await mongo.close();
    process.exit(1);
  }

  try {
    await sql`SELECT 1`;
  } catch (error) {
    console.error(`\nNeon unreachable: ${error.message}`);
    console.error("Aborting before making any changes.");
    await mongo.close();
    process.exit(1);
  }

  const db = mongo.db();
  const gamesCollection = db.collection("games");

  // --- inventory ----------------------------------------------------------
  const neonCount = (await sql`SELECT COUNT(*)::int AS n FROM games`)[0].n;
  const mongoCount = await gamesCollection.countDocuments();

  const redisKeys = new Set();
  for (const pattern of REDIS_PATTERNS) {
    for (const key of await redis.keys(pattern)) redisKeys.add(key);
  }

  console.log("\nWill delete:");
  console.log(`  Neon    games table      : ${neonCount} row(s)`);
  console.log(`  MongoDB games collection: ${mongoCount} document(s)`);
  console.log(`  Redis   app keys         : ${redisKeys.size} key(s)`);
  const byPrefix = new Map();
  for (const key of redisKeys) {
    const group = key.split(":")[0] + (key.includes(":") ? ":*" : "");
    byPrefix.set(group, (byPrefix.get(group) || 0) + 1);
  }
  for (const [group, n] of [...byPrefix.entries()].sort()) {
    console.log(`             ${group.padEnd(22)} ${n}`);
  }

  if (!CONFIRM) {
    console.log("\n" + "=".repeat(60));
    console.log("Dry run only. Re-run with --yes to wipe.");
    await mongo.close();
    return;
  }

  // --- wipe ---------------------------------------------------------------
  console.log("\nWiping...");

  // RETURNING id gives us the deleted rows, so the count is accurate.
  // (A bare DELETE returns an empty result set from the neon template tag.)
  const deletedNeon = await sql`DELETE FROM games RETURNING id`;
  console.log(`  Neon    : ${deletedNeon.length} row(s) deleted`);

  const deletedMongo = await gamesCollection.deleteMany({});
  console.log(`  MongoDB : ${deletedMongo.deletedCount} document(s) deleted`);

  // The games index is created by the backfill script; keep it.
  try {
    await gamesCollection.createIndex({ id: 1 }, { unique: false });
  } catch {
    /* index creation is best-effort */
  }

  let deletedRedis = 0;
  const keys = [...redisKeys];
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    if (chunk.length) deletedRedis += await redis.del(...chunk);
  }
  console.log(`  Redis   : ${deletedRedis} key(s) deleted`);

  console.log("\n" + "=".repeat(60));
  console.log("Reset complete. Restart the dev server to re-prime the cache.");

  await mongo.close();
}

main().catch((error) => {
  console.error("Reset failed:", error);
  process.exit(1);
});
