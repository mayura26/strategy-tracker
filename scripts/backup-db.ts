import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createClient } from "@libsql/client";

const tables = [
  "bots",
  "bot_modes",
  "instruments",
  "runs",
  "imports",
  "trade_summaries",
  "daily_run_metrics",
  "golden_baselines",
  "market_bars",
  "combos",
  "combo_versions",
  "analysis_settings",
] as const;

const databaseUrl =
  process.env.TURSO_DATABASE_URL?.trim() || "file:strategy-tracker.local.db";
const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
const backupDir = resolve(process.env.BACKUP_DIR?.trim() || "./backups");

const client = createClient({
  url: databaseUrl,
  authToken,
});

async function main() {
  await mkdir(backupDir, { recursive: true });

  const snapshot: Record<string, unknown> = {
    createdAt: new Date().toISOString(),
    databaseUrl: redactDatabaseUrl(databaseUrl),
    format: "strategy-tracker-json-backup-v1",
    tables: {},
  };

  for (const table of tables) {
    const result = await client.execute(`SELECT * FROM ${table}`);
    (snapshot.tables as Record<string, unknown[]>)[table] = result.rows.map(
      (row) => ({ ...row }),
    );
  }

  const fileName = `strategy-tracker-${timestampForFile()}.json`;
  const filePath = join(backupDir, fileName);
  await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`Backup written: ${filePath}`);
}

function timestampForFile() {
  return new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

function redactDatabaseUrl(url: string) {
  if (url.startsWith("file:")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "remote";
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
