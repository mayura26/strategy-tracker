"use client";

import { AlertTriangle, CheckCircle2, RotateCcw, Upload } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { uploadRunCsv } from "@/app/actions";
import type { BotOption, InstrumentOption } from "@/lib/db/repository";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { buildImportPreview, type ImportPreview } from "@/lib/import-preview";

export function ImportRunForm({
  bots,
  instruments,
}: {
  bots: BotOption[];
  instruments: InstrumentOption[];
}) {
  const firstBotWithMode = bots.find((bot) => bot.modes.length > 0);
  const [botId, setBotId] = useState(firstBotWithMode?.id ?? bots[0]?.id ?? "");
  const [botModeId, setBotModeId] = useState(
    firstBotWithMode?.modes[0]?.id ?? "",
  );
  const [instrumentId, setInstrumentId] = useState(instruments[0]?.id ?? "");
  const [timeframe, setTimeframe] = useState("");
  const [pasteMessage, setPasteMessage] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [rawCsv, setRawCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const selectedBot = useMemo(
    () => bots.find((bot) => bot.id === botId) ?? bots[0],
    [botId, bots],
  );
  const selectedInstrument = useMemo(
    () =>
      instruments.find((instrument) => instrument.id === instrumentId) ??
      instruments[0],
    [instrumentId, instruments],
  );
  const modes = selectedBot?.modes ?? [];
  const effectiveBotModeId = modes.some((mode) => mode.id === botModeId)
    ? botModeId
    : (modes[0]?.id ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (preview) {
      return;
    }

    event.preventDefault();
    setPreviewError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("csvFile");

    try {
      JSON.parse(String(formData.get("settingsJson") || "{}"));

      if (!selectedInstrument) {
        throw new Error("Choose an instrument before previewing the import.");
      }

      if (!(file instanceof File) || file.size === 0) {
        throw new Error("Choose a NinjaTrader CSV export before previewing.");
      }

      const text = await file.text();
      setRawCsv(text);
      setFileName(file.name);
      setPreview(buildImportPreview(text, selectedInstrument.sessionStartHour));
    } catch (error) {
      setPreview(null);
      setRawCsv("");
      setFileName("");
      setPreviewError(
        error instanceof Error
          ? error.message
          : "The CSV could not be previewed.",
      );
    }
  }

  function clearPreview() {
    setPreview(null);
    setRawCsv("");
    setFileName("");
    setPreviewError("");
  }

  return (
    <form
      action={uploadRunCsv}
      className="panel grid gap-6"
      onSubmit={handleSubmit}
    >
      {preview ? (
        <>
          <textarea hidden name="rawCsv" readOnly value={rawCsv} />
          <input name="fileName" type="hidden" value={fileName} />
        </>
      ) : null}
      <label className="grid gap-2">
        <span className="label-text">Bot load text</span>
        <textarea
          className="input min-h-28 font-mono text-sm"
          onChange={(event) => {
            const result = applyLoadText(event.target.value, bots, instruments);

            if (result.botId) {
              setBotId(result.botId);
            }

            if (result.botModeId) {
              setBotModeId(result.botModeId);
            }

            if (result.instrumentId) {
              setInstrumentId(result.instrumentId);
            }

            if (result.timeframe) {
              setTimeframe(result.timeframe);
            }

            if (result.instrumentId) {
              clearPreview();
            }

            setPasteMessage(result.message);
          }}
          placeholder={`[Tempest] Bot loaded: Tempest
[Tempest] Mode: Cyclone
[Tempest] Account: Playback101
[Tempest] Instrument: SIL
[Tempest] Timeframe: 30s`}
        />
        {pasteMessage ? (
          <span className="quiet-text text-sm">{pasteMessage}</span>
        ) : null}
      </label>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2">
          <span className="label-text">Bot</span>
          <select
            className="input"
            name="botId"
            onChange={(event) => {
              const nextBotId = event.target.value;
              const nextBot = bots.find((bot) => bot.id === nextBotId);
              setBotId(nextBotId);
              setBotModeId(nextBot?.modes[0]?.id ?? "");
            }}
            required
            value={botId}
          >
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="label-text">Bot mode</span>
          <select
            className="input"
            name="botModeId"
            onChange={(event) => setBotModeId(event.target.value)}
            required
            value={effectiveBotModeId}
          >
            {modes.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Run name"
          name="runName"
          placeholder="Adjusted end times"
        />
        <label className="grid gap-2">
          <span className="label-text">Instrument</span>
          <select
            className="input"
            name="instrumentId"
            onChange={(event) => {
              setInstrumentId(event.target.value);
              clearPreview();
            }}
            required
            value={instrumentId}
          >
            {instruments.map((instrument) => (
              <option key={instrument.id} value={instrument.id}>
                {instrument.symbol}
                {instrument.yahooSymbol ? ` / ${instrument.yahooSymbol}` : ""}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Timeframe"
          name="timeframe"
          onChange={setTimeframe}
          placeholder="5m"
          value={timeframe}
        />
        <Field label="Tags" name="tags" placeholder="grid, overnight" />
      </div>
      <label className="grid gap-2">
        <span className="label-text">Settings JSON</span>
        <textarea
          className="input min-h-28 font-mono text-sm"
          defaultValue="{}"
          name="settingsJson"
          placeholder='{"endTime":"15:45","atrFilter":false}'
        />
      </label>
      <label className="grid gap-2">
        <span className="label-text">Notes</span>
        <textarea
          className="input min-h-24"
          name="notes"
          placeholder="What changed in this run?"
        />
      </label>
      <label className="grid gap-2">
        <span className="label-text">NinjaTrader CSV</span>
        <input
          accept=".csv,text/csv"
          className="input file:mr-4 file:rounded-md file:border-0 file:bg-amber-400 file:px-3 file:py-2 file:text-slate-950"
          name="csvFile"
          onChange={clearPreview}
          required
          type="file"
        />
      </label>
      {previewError ? (
        <div className="subtle-card flex items-start gap-3 border-rose-400/35 bg-rose-950/20 p-4 text-sm text-rose-200">
          <AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={18} />
          <p>{previewError}</p>
        </div>
      ) : null}
      {preview ? (
        <ImportPreviewPanel fileName={fileName} preview={preview} />
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button className="primary-button" type="submit">
          {preview ? (
            <CheckCircle2 aria-hidden size={16} />
          ) : (
            <Upload aria-hidden size={16} />
          )}
          {preview ? "Confirm and save" : "Preview import"}
        </button>
        {preview ? (
          <button className="ghost-button" onClick={clearPreview} type="button">
            <RotateCcw aria-hidden size={16} />
            Edit import
          </button>
        ) : null}
      </div>
    </form>
  );
}

function ImportPreviewPanel({
  fileName,
  preview,
}: {
  fileName: string;
  preview: ImportPreview;
}) {
  const topDays = [...preview.dailyMetrics]
    .sort((left, right) => Math.abs(right.netProfit) - Math.abs(left.netProfit))
    .slice(0, 5);

  return (
    <section className="subtle-card grid gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-amber-300">
            Import preview
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">{fileName}</h2>
          <p className="quiet-text mt-1 text-sm">
            Review the parsed Strategy Analyzer summary before saving this run.
          </p>
        </div>
        <div className="rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-200">
          {preview.parsed.rowCount} trades parsed
        </div>
      </div>
      <div className="metric-grid">
        <PreviewMetric
          label="Net PnL"
          value={formatCurrency(preview.metrics.netProfit)}
        />
        <PreviewMetric
          label="Win rate"
          value={formatPercent(preview.metrics.winRate)}
        />
        <PreviewMetric
          label="Max drawdown"
          value={formatCurrency(preview.metrics.maxDrawdown)}
        />
        <PreviewMetric
          label="Profit factor"
          value={
            preview.metrics.profitFactor === null
              ? "n/a"
              : preview.metrics.profitFactor.toFixed(2)
          }
        />
        <PreviewMetric
          label="Trading days"
          value={String(preview.dailyMetrics.length)}
        />
        <PreviewMetric
          label="Date range"
          value={`${preview.dateRange.first ?? "n/a"} to ${
            preview.dateRange.last ?? "n/a"
          }`}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="label-text mb-2">Trade bounds</p>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="quiet-text">First trade</dt>
              <dd className="text-right text-slate-200">
                {preview.firstTradeRaw ?? "n/a"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="quiet-text">Last trade</dt>
              <dd className="text-right text-slate-200">
                {preview.lastTradeRaw ?? "n/a"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="quiet-text">First close date</dt>
              <dd className="text-right text-slate-200">
                {formatDate(preview.metrics.firstTradeAt)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="quiet-text">Last close date</dt>
              <dd className="text-right text-slate-200">
                {formatDate(preview.metrics.lastTradeAt)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="overflow-x-auto">
          <p className="label-text mb-2">Largest daily moves</p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Trades</th>
                <th>PnL</th>
              </tr>
            </thead>
            <tbody>
              {topDays.map((day) => (
                <tr key={day.tradingDate}>
                  <td>{day.tradingDate}</td>
                  <td>{day.tradeCount}</td>
                  <td>{formatCurrency(day.netProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {preview.warnings.length > 0 ? (
        <div className="border-t border-amber-400/30 pt-3">
          <p className="label-text mb-2">Warnings</p>
          <ul className="grid gap-1 text-sm text-amber-100">
            {preview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="border-t border-emerald-400/25 pt-3 text-sm text-emerald-100">
          No import warnings detected.
        </div>
      )}
    </section>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function applyLoadText(
  text: string,
  bots: BotOption[],
  instruments: InstrumentOption[],
) {
  const parsed = parseLoadText(text);
  const bot = parsed.bot
    ? bots.find((candidate) => sameName(candidate.name, parsed.bot))
    : null;
  const mode =
    bot && parsed.mode
      ? bot.modes.find((candidate) => sameName(candidate.name, parsed.mode))
      : null;
  const instrument = parsed.instrument
    ? instruments.find((candidate) =>
        sameName(candidate.symbol, parsed.instrument),
      )
    : null;
  const missing = [
    parsed.bot && !bot ? `bot "${parsed.bot}"` : "",
    parsed.mode && !mode ? `mode "${parsed.mode}"` : "",
    parsed.instrument && !instrument ? `instrument "${parsed.instrument}"` : "",
  ].filter(Boolean);

  return {
    botId: bot?.id,
    botModeId: mode?.id,
    instrumentId: instrument?.id,
    timeframe: parsed.timeframe,
    message:
      missing.length > 0
        ? `No saved ${missing.join(", ")} found. Add it in Settings first.`
        : parsed.bot || parsed.mode || parsed.instrument || parsed.timeframe
          ? "Matched saved fields and timeframe where available."
          : "",
  };
}

function parseLoadText(text: string) {
  return {
    bot: findField(text, /Bot loaded:\s*([^\r\n]+)/i),
    mode: findField(text, /Mode:\s*([^\r\n]+)/i),
    instrument: findField(text, /Instrument:\s*([^\r\n]+)/i),
    timeframe: findField(text, /Timeframe:\s*([^\r\n]+)/i),
  };
}

function findField(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.trim() ?? "";
}

function sameName(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="label-text">{label}</span>
      <input
        className="input"
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
        name={name}
        placeholder={placeholder}
        required={["runName", "timeframe"].includes(name)}
        type={type}
        value={value}
      />
    </label>
  );
}
