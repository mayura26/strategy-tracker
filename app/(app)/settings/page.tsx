import { Plus } from "lucide-react";

import {
  createBotAction,
  createBotModeAction,
  createInstrumentAction,
  updateAnalysisSettingsAction,
} from "@/app/actions";
import {
  getAnalysisSettings,
  listBotsWithModes,
  listInstruments,
} from "@/lib/db/repository";

export default async function SettingsPage() {
  const [bots, instruments, analysisSettings] = await Promise.all([
    listBotsWithModes(),
    listInstruments(),
    getAnalysisSettings(),
  ]);

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>Settings</h1>
          <p>
            Create bots, operating modes, and instruments before importing runs.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="panel h-fit">
          <div className="section-title">
            <h2>Create bot</h2>
          </div>
          <form action={createBotAction} className="grid gap-3">
            <input
              className="input"
              name="name"
              placeholder="Grid Bot"
              required
            />
            <button className="primary-button" type="submit">
              <Plus aria-hidden size={16} />
              Add bot
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="section-title">
            <h2>Create mode</h2>
            <p>Examples: baseline, high ATR, low ATR, no-news, aggressive.</p>
          </div>
          <form
            action={createBotModeAction}
            className="grid gap-3 md:grid-cols-3"
          >
            <select className="input" name="botId" required>
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              name="name"
              placeholder="Mode name"
              required
            />
            <input
              className="input"
              name="description"
              placeholder="Short description"
            />
            <button className="primary-button md:col-span-3" type="submit">
              <Plus aria-hidden size={16} />
              Add mode
            </button>
          </form>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>Create instrument</h2>
          <p>Session settings are saved once and reused on every import.</p>
        </div>
        <form
          action={createInstrumentAction}
          className="grid gap-3 md:grid-cols-5"
        >
          <input className="input" name="symbol" placeholder="SIL" required />
          <input className="input" name="name" placeholder="Silver micro" />
          <input className="input" name="yahooSymbol" placeholder="SI=F" />
          <input
            className="input"
            name="exchangeTimezone"
            placeholder="America/New_York"
            defaultValue="America/New_York"
          />
          <input
            className="input"
            name="sessionStartHour"
            placeholder="18"
            defaultValue="18"
            max="23"
            min="0"
            required
            type="number"
          />
          <button className="primary-button md:col-span-5" type="submit">
            <Plus aria-hidden size={16} />
            Add instrument
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Analysis indicators</h2>
            <p>Global defaults for predictive regime discovery.</p>
          </div>
        </div>
        <form
          action={updateAnalysisSettingsAction}
          className="grid gap-3 md:grid-cols-5"
        >
          <label className="grid gap-2">
            <span className="label-text">EMA fast</span>
            <input
              className="input"
              defaultValue={analysisSettings.emaFastPeriod}
              min="1"
              name="emaFastPeriod"
              required
              type="number"
            />
          </label>
          <label className="grid gap-2">
            <span className="label-text">EMA mid</span>
            <input
              className="input"
              defaultValue={analysisSettings.emaMidPeriod}
              min="1"
              name="emaMidPeriod"
              required
              type="number"
            />
          </label>
          <label className="grid gap-2">
            <span className="label-text">EMA slow</span>
            <input
              className="input"
              defaultValue={analysisSettings.emaSlowPeriod}
              min="1"
              name="emaSlowPeriod"
              required
              type="number"
            />
          </label>
          <label className="grid gap-2">
            <span className="label-text">RSI period</span>
            <input
              className="input"
              defaultValue={analysisSettings.rsiPeriod}
              min="1"
              name="rsiPeriod"
              required
              type="number"
            />
          </label>
          <div className="flex items-end">
            <button className="primary-button w-full" type="submit">
              Save indicators
            </button>
          </div>
        </form>
        <p className="quiet-text mt-3 text-sm">
          EMA periods must be ordered fast &lt; mid &lt; slow. Current defaults
          are used on run-detail predictive regime analysis.
        </p>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>Bots and modes</h2>
          <p>{bots.length} bots configured.</p>
        </div>
        {bots.length === 0 ? (
          <p className="quiet-text text-sm">
            No bots yet. Create one above, then add at least one mode.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bots.map((bot) => (
              <article className="mini-metric" key={bot.id}>
                <span>Bot</span>
                <strong>{bot.name}</strong>
                <div className="mt-4 grid gap-2">
                  {bot.modes.length === 0 ? (
                    <p className="quiet-text text-sm">No modes yet.</p>
                  ) : (
                    bot.modes.map((mode) => (
                      <div className="subtle-card p-3" key={mode.id}>
                        <p className="strong-text font-semibold">{mode.name}</p>
                        {mode.description ? (
                          <p className="quiet-text mt-1 text-sm">
                            {mode.description}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>Instruments</h2>
          <p>{instruments.length} instruments configured.</p>
        </div>
        {instruments.length === 0 ? (
          <p className="quiet-text text-sm">
            No instruments yet. Add symbols like ES, NQ, SIL, or CL above.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Yahoo</th>
                <th>Timezone</th>
                <th>Session start</th>
              </tr>
            </thead>
            <tbody>
              {instruments.map((instrument) => (
                <tr key={instrument.id}>
                  <td className="strong-text font-semibold">
                    {instrument.symbol}
                  </td>
                  <td>{instrument.name ?? "n/a"}</td>
                  <td>{instrument.yahooSymbol ?? "n/a"}</td>
                  <td>{instrument.exchangeTimezone}</td>
                  <td>{instrument.sessionStartHour}:00</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
