import { defineConfig } from "drizzle-kit";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
const isLocal = !url || url.includes("localhost") || url.includes("127.0.0.1");

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  },
});

