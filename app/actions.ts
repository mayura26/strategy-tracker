"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import {
  createBot,
  createBotMode,
  createInstrument,
  deleteSavedCombo,
  getInstrument,
  insertImportedRun,
  listInstruments,
  saveCombo,
  setGoldenRun,
  updateSavedCombo,
  upsertMarketBar,
} from "@/lib/db/repository";
import { buildImportPreview } from "@/lib/import-preview";
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
  const providedRawCsv = String(formData.get("rawCsv") ?? "");
  const rawCsv =
    providedRawCsv.trim().length > 0
      ? providedRawCsv
      : file instanceof File
        ? await file.text()
        : "";

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

  if (rawCsv.trim().length === 0) {
    throw new Error("Choose a NinjaTrader CSV export before importing.");
  }

  JSON.parse(fields.settingsJson);
  const instrument = await getInstrument(fields.instrumentId);

  if (!instrument) {
    throw new Error("Choose a valid instrument.");
  }

  const preview = buildImportPreview(rawCsv, instrument.sessionStartHour);
  const runId = await insertImportedRun({
    ...fields,
    fileName: getImportFileName(formData, file),
    fileHash: createHash("sha256").update(rawCsv).digest("hex"),
    rawCsv,
    importProfile: preview.parsed.profile,
    headers: preview.parsed.headers,
    metrics: preview.metrics,
    dailyMetrics: preview.dailyMetrics,
    trades: preview.parsed.trades,
  });

  revalidatePath("/runs");
  redirect(`/runs/${runId}`);
}

function getImportFileName(
  formData: FormData,
  file: FormDataEntryValue | null,
) {
  const providedFileName = String(formData.get("fileName") ?? "").trim();

  if (providedFileName) {
    return providedFileName;
  }

  if (file instanceof File && file.name) {
    return file.name;
  }

  return "ninjatrader-import.csv";
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

export async function updateComboAction(formData: FormData) {
  await requireUser();

  const id = String(formData.get("comboId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const runIds = formData
    .getAll("componentRunId")
    .map((runId) => String(runId).trim())
    .filter(Boolean);
  const config = runIds
    .map((runId) => ({
      runId,
      weight: Number(formData.get(`weight:${runId}`) ?? 0),
    }))
    .filter((item) => Number.isFinite(item.weight) && item.weight !== 0);

  if (!id) {
    throw new Error("Missing combo id.");
  }

  if (!name) {
    throw new Error("Combo name is required.");
  }

  if (config.length === 0) {
    throw new Error("At least one combo component needs a non-zero weight.");
  }

  await updateSavedCombo({
    id,
    name,
    description,
    configJson: JSON.stringify(config),
  });
  revalidatePath("/combos");
  revalidatePath(`/combos/${id}`);
}

export async function deleteComboAction(formData: FormData) {
  await requireUser();

  const id = String(formData.get("comboId") ?? "").trim();

  if (!id) {
    throw new Error("Missing combo id.");
  }

  await deleteSavedCombo(id);
  revalidatePath("/combos");
  redirect("/combos");
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
