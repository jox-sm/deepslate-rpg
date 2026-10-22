/**
 * Backfill MongoDB with a shell document for every game that exists in
 * Neon/PostgreSQL.
 *
 * Why this exists: MongoDB holds the nested game data (characters / maps /
 * items) while Neon holds the row-level fields (id, name, likes_count,
 * description, image, tags, timestamps). An Atlas cluster that sits idle is
 * terminated, and the nested data goes with it. Neon cannot restore it
 * because it never stored it.
 *
 * This script re-seeds one document per Neon game with empty nested arrays
 * so the read path finds a document instead of null, and so the collection
 * (and its indexes) exist again.
 *
 * It is deliberately non-destructive: it uses $setOnInsert with an upsert, so
 * a game that already has characters/maps/items in MongoDB is never touched.
 *
 * Usage:
 *   node --env-file=.env --env-file=.env.local db/backfill-mongo.mjs
 */

import { MongoClient } from "mongodb";
import { neon } from "@neondatabase/serverless";

const uri = process.env.MONGODB_URI;
const databaseUrl = process.env.DATABASE_URL;

if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
if (uri.includes("<db_password>") || uri.includes("YOUR_MONGODB_PASS")) {
  console.error("MONGODB_URI still contains a placeholder password");
  process.exit(1);
}

const BATCH_SIZE = 100;

async function main() {
  const sql = neon(databaseUrl);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();

  const db = client.db();
  const games = db.collection("games");

  console.log(`MongoDB database: ${db.databaseName}`);
  console.log(`MongoDB collection: ${games.collectionName}`);

  // Every game row in Neon.
  const rows = await sql`
    SELECT id FROM games
    ORDER BY created_at DESC
  `;
  console.log(`\nNeon games: ${rows.length}`);

  const existing = await games.countDocuments();
  console.log(`MongoDB documents before: ${existing}`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const ops = chunk.map((row) => ({
      updateOne: {
        filter: { id: row.id },
        // $setOnInsert => never modifies a document that already exists.
        update: {
          $setOnInsert: {
            id: row.id,
            characters: [],
            maps: [],
            items: [],
            status: "draft",
          },
        },
        upsert: true,
      },
    }));

    const result = await games.bulkWrite(ops, { ordered: false });
    created += result.upsertedCount;
    skipped += result.modifiedCount + result.matchedCount;
  }

  const after = await games.countDocuments();
  console.log(`\ncreated: ${created}`);
  console.log(`left untouched (already present): ${skipped}`);
  console.log(`MongoDB documents after: ${after}`);

  // Make sure the index the schema declares actually exists.
  try {
    await games.createIndex({ id: 1 }, { unique: false });
    console.log("index on `id` ensured");
  } catch (error) {
    console.error("index creation failed:", error.message);
  }

  await client.close();
  console.log("\nDone.");
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
