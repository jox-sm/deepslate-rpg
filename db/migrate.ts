import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    console.error("database url is not defined in .env file");
    return;
  }

  const sql = neon(url);

  try {

    const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    await sql.unsafe(schema);

    console.log("done");
  } catch (error) {
    console.error("Error during migration:");
    console.error(error);
  }
}

runMigration();