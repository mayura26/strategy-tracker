"use client";

import { Upload } from "lucide-react";
import { useMemo, useState } from "react";

import { uploadRunCsv } from "@/app/actions";
import type { BotOption, InstrumentOption } from "@/lib/db/repository";

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
  const selectedBot = useMemo(
    () => bots.find((bot) => bot.id === botId) ?? bots[0],
    [botId, bots],
  );
  const modes = selectedBot?.modes ?? [];
  const effectiveBotModeId = modes.some((mode) => mode.id === botModeId)
    ? botModeId
    : (modes[0]?.id ?? "");

  return (
    <form action={uploadRunCsv} className="panel grid gap-6">
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
            onChange={(event) => setInstrumentId(event.target.value)}
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
          required
          type="file"
        />
      </label>
      <div>
        <button className="primary-button" type="submit">
          <Upload aria-hidden size={16} />
          Import and analyse
        </button>
      </div>
    </form>
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
        required={["runName", "instrumentSymbol", "timeframe"].includes(name)}
        type={type}
        value={value}
      />
    </label>
  );
}
