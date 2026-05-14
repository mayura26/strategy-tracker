import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.TURSO_DATABASE_URL?.trim() || "file:strategy-tracker.local.db";
const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: databaseUrl,
    authToken,
  },
  breakpoints: true,
});
