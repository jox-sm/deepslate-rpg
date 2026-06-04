import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { classifyError } from '@/utilities/errorHandler';

dotenv.config();

async function runMigration() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    console.error("DATABASE_URL is not defined");
    return;
  }

  const sql = neon(url);

  try {
    const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0); 

    for (const statement of statements) {
      console.log("Running:", statement.substring(0, 50) + "...");
      await sql.query(statement);
    }

    console.log("Migration done!");
  } catch (error) {
    const classified = classifyError(error, "migrate.runMigration");
    console.error("Error during migration:", classified.message);
  }
}

runMigration();