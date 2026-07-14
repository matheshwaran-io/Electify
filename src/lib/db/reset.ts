import "dotenv/config";
import { Pool } from "pg";

async function reset() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL must be set");
  }

  const pool = new Pool({ connectionString });
  console.log("Dropping public schema...");
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  console.log("Schema dropped.");
  
  await pool.end();
}

reset().catch((error) => {
  console.error("❌ Reset failed:", error);
  process.exit(1);
});
