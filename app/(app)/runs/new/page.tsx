import { Upload } from "lucide-react";

import { uploadRunCsv } from "@/app/actions";

export default function NewRunPage() {
  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>Import run</h1>
          <p>
            Upload the NinjaTrader Strategy Analyzer trade summary export and
            attach the metadata missing from the CSV.
          </p>
        </div>
      </section>

      <form action={uploadRunCsv} className="panel grid gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Bot name" name="botName" placeholder="Grid Bot" />
          <Field label="Run name" name="runName" placeholder="ATR sweep 01" />
          <Field label="Instrument" name="instrumentSymbol" placeholder="ES" />
          <Field label="Yahoo symbol" name="yahooSymbol" placeholder="ES=F" />
          <Field label="Timeframe" name="timeframe" placeholder="5m" />
          <Field
            label="Exchange timezone"
            name="exchangeTimezone"
            placeholder="America/New_York"
            value="America/New_York"
          />
          <Field
            label="Session start hour"
            name="sessionStartHour"
            placeholder="18"
            type="number"
            value="18"
          />
          <Field label="Tags" name="tags" placeholder="grid, overnight" />
        </div>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-stone-700">
            Settings JSON
          </span>
          <textarea
            className="input min-h-28 font-mono text-sm"
            defaultValue="{}"
            name="settingsJson"
            placeholder='{"mode":"baseline","atrFilter":false}'
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-stone-700">Notes</span>
          <textarea
            className="input min-h-24"
            name="notes"
            placeholder="What changed in this run?"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-stone-700">
            NinjaTrader CSV
          </span>
          <input
            accept=".csv,text/csv"
            className="input file:mr-4 file:rounded-md file:border-0 file:bg-stone-950 file:px-3 file:py-2 file:text-white"
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
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  value,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  value?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      <input
        className="input"
        defaultValue={value}
        name={name}
        placeholder={placeholder}
        required={[
          "botName",
          "runName",
          "instrumentSymbol",
          "timeframe",
        ].includes(name)}
        type={type}
      />
    </label>
  );
}
