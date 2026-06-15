import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // In Prisma 7, directUrl is no longer supported directly. 
    // We dynamically use DIRECT_URL for migrations/push CLI operations,
    // and default to DATABASE_URL for primary application runtime transactions.
    url: env("DIRECT_URL") || env("DATABASE_URL"),
  },
});
