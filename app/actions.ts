"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { calculateDailyMetrics, calculateRunMetrics } from "@/lib/analytics";
import {
  createBot,
  createBotMode,
  createInstrument,
  getInstrument,
  insertImportedRun,
  listInstruments,
  saveCombo,
  setGoldenRun,
  upsertMarketBar,
} from "@/lib/db/repository";
import { parseNinjaTraderSummaryCsv } from "@/lib/imports/ninjatrader";
import { fetchYahooDailyBars } from "@/lib/market/yahoo";

const uploadSchema = z.object({
  botId: z.string().min(1),
  botModeId: z.string().min(1),
  instrumentId: z.string().min(1),
  timeframe: z.string().min(1),
  runName: z.string().min(1),
  settingsJson: z.string().optional().default("{}"),
  tags: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export async function uploadRunCsv(formData: FormData) {
  await requireUser();

  const file = formData.get("csvFile");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a NinjaTrader CSV export before importing.");
  }

  const fields = uploadSchema.parse({
    botId: formData.get("botId"),
    botModeId: formData.get("botModeId"),
    instrumentId: formData.get("instrumentId"),
    timeframe: formData.get("timeframe"),
    runName: formData.get("runName"),
    settingsJson: formData.get("settingsJson") || "{}",
    tags: formData.get("tags"),
    notes: formData.get("notes"),
  });

  JSON.parse(fields.settingsJson);
  const instrument = await getInstrument(fields.instrumentId);

  if (!instrument) {
    throw new Error("Choose a valid instrument.");
  }

  const rawCsv = await file.text();
  const parsed = parseNinjaTraderSummaryCsv(
    rawCsv,
    instrument.sessionStartHour,
  );
  const metrics = calculateRunMetrics(parsed.trades);
  const dailyMetrics = calculateDailyMetrics(parsed.trades);
  const runId = await insertImportedRun({
    ...fields,
    fileName: file.name,
    fileHash: createHash("sha256").update(rawCsv).digest("hex"),
    rawCsv,
    importProfile: parsed.profile,
    headers: parsed.headers,
    metrics,
    dailyMetrics,
    trades: parsed.trades,
  });

  revalidatePath("/runs");
  redirect(`/runs/${runId}`);
}

export async function createBotAction(formData: FormData) {
  await requireUser();

  await createBot({
    name: String(formData.get("name") ?? ""),
  });

  revalidatePath("/settings");
  revalidatePath("/runs/new");
}

export async function createBotModeAction(formData: FormData) {
  await requireUser();

  await createBotMode({
    botId: String(formData.get("botId") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });

  revalidatePath("/settings");
  revalidatePath("/runs/new");
}

export async function createInstrumentAction(formData: FormData) {
  await requireUser();

  await createInstrument({
    symbol: String(formData.get("symbol") ?? ""),
    name: String(formData.get("name") ?? ""),
    yahooSymbol: String(formData.get("yahooSymbol") ?? ""),
    exchangeTimezone:
      String(formData.get("exchangeTimezone") ?? "").trim() ||
      "America/New_York",
    sessionStartHour: z.coerce
      .number()
      .int()
      .min(0)
      .max(23)
      .parse(formData.get("sessionStartHour") || 18),
  });

  revalidatePath("/settings");
  revalidatePath("/runs/new");
  revalidatePath("/market-data");
}

export async function setGoldenRunAction(formData: FormData) {
  await requireUser();

  const runId = String(formData.get("runId") ?? "");

  if (!runId) {
    throw new Error("Missing run id.");
  }

  await setGoldenRun(runId);
  revalidatePath("/runs");
  revalidatePath(`/runs/${runId}`);
}

export async function saveComboAction(formData: FormData) {
  await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const configJson = String(formData.get("configJson") ?? "[]");

  if (!name) {
    throw new Error("Combo name is required.");
  }

  JSON.parse(configJson);

  await saveCombo({ name, description, configJson });
  revalidatePath("/combos");
}

export async function refreshMarketDataAction(formData: FormData) {
  await requireUser();

  const instrumentId = String(formData.get("instrumentId") ?? "");
  const yahooSymbol = String(formData.get("yahooSymbol") ?? "").trim();

  if (!instrumentId || !yahooSymbol) {
    throw new Error("Instrument and Yahoo symbol are required.");
  }

  const from = new Date();
  from.setDate(from.getDate() - 420);
  const to = new Date();
  to.setDate(to.getDate() + 1);

  try {
    const bars = await fetchYahooDailyBars(yahooSymbol, from, to);

    for (const bar of bars) {
      await upsertMarketBar({
        instrumentId,
        yahooSymbol,
        ...bar,
        sourceStatus: "ok",
        sourceMessage: null,
      });
    }
  } catch (error) {
    await upsertMarketBar({
      instrumentId,
      yahooSymbol,
      tradingDate: new Date().toISOString().slice(0, 10),
      open: null,
      high: null,
      low: null,
      close: null,
      volume: null,
      trueRange: null,
      atr14: null,
      range: null,
      gap: null,
      sourceStatus: "error",
      sourceMessage:
        error instanceof Error ? error.message : "Yahoo fetch failed.",
    });
  }

  revalidatePath("/market-data");
}

export async function refreshAllMarketDataAction() {
  await requireUser();

  const instruments = await listInstruments();

  for (const instrument of instruments) {
    if (!instrument.yahooSymbol) {
      continue;
    }

    const formData = new FormData();
    formData.set("instrumentId", instrument.id);
    formData.set("yahooSymbol", instrument.yahooSymbol);
    await refreshMarketDataAction(formData);
  }
}

async function requireUser() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
}
