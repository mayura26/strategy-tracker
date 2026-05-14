import { Plus, Save } from "lucide-react";

import {
  createBotAction,
  createBotModeAction,
  createInstrumentAction,
  updateAnalysisSettingsAction,
  updateBotAction,
  updateBotModeAction,
  updateInstrumentAction,
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
          className="grid gap-3 md:grid-cols-4 xl:grid-cols-8"
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
          <label className="grid gap-2">
            <span className="label-text">ATR period</span>
            <input
              className="input"
              defaultValue={analysisSettings.atrPeriod}
              min="1"
              name="atrPeriod"
              required
              type="number"
            />
          </label>
          <label className="grid gap-2">
            <span className="label-text">Cross lookback</span>
            <input
              className="input"
              defaultValue={analysisSettings.emaCrossLookbackDays}
              min="1"
              name="emaCrossLookbackDays"
              required
              type="number"
            />
          </label>
          <label className="grid gap-2">
            <span className="label-text">RSI lower</span>
            <input
              className="input"
              defaultValue={analysisSettings.rsiLowerBand}
              max="100"
              min="0"
              name="rsiLowerBand"
              required
              type="number"
            />
          </label>
          <label className="grid gap-2">
            <span className="label-text">RSI upper</span>
            <input
              className="input"
              defaultValue={analysisSettings.rsiUpperBand}
              max="100"
              min="0"
              name="rsiUpperBand"
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
          are used on run-detail predictive regime analysis, threshold
          discovery, and market charts.
        </p>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>Bots and modes</h2>
          <p>{bots.length} bots configured. Rename bots or modes in place.</p>
        </div>
        {bots.length === 0 ? (
          <p className="quiet-text text-sm">
            No bots yet. Create one above, then add at least one mode.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bots.map((bot) => (
              <article className="mini-metric" key={bot.id}>
                <form action={updateBotAction} className="grid gap-2">
                  <input name="botId" type="hidden" value={bot.id} />
                  <label className="grid gap-2">
                    <span>Bot</span>
                    <input
                      className="input"
                      defaultValue={bot.name}
                      name="name"
                      required
                    />
                  </label>
                  <button className="ghost-button min-h-9" type="submit">
                    <Save aria-hidden size={15} />
                    Save bot
                  </button>
                </form>
                <div className="mt-4 grid gap-2">
                  {bot.modes.length === 0 ? (
                    <p className="quiet-text text-sm">No modes yet.</p>
                  ) : (
                    bot.modes.map((mode) => (
                      <form
                        action={updateBotModeAction}
                        className="subtle-card grid gap-2 p-3"
                        key={mode.id}
                      >
                        <input name="botModeId" type="hidden" value={mode.id} />
                        <input
                          className="input min-h-10"
                          defaultValue={mode.name}
                          name="name"
                          required
                        />
                        <input
                          className="input min-h-10"
                          defaultValue={mode.description}
                          name="description"
                          placeholder="Description"
                        />
                        <button className="ghost-button min-h-9" type="submit">
                          <Save aria-hidden size={15} />
                          Save mode
                        </button>
                      </form>
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
          <p>
            {instruments.length} instruments configured. Session changes affect
            new imports only.
          </p>
        </div>
        {instruments.length === 0 ? (
          <p className="quiet-text text-sm">
            No instruments yet. Add symbols like ES, NQ, SIL, or CL above.
          </p>
        ) : (
          <div className="grid gap-3">
            {instruments.map((instrument) => (
              <form
                action={updateInstrumentAction}
                className="subtle-card grid gap-3 p-3 lg:grid-cols-[0.7fr_1fr_0.8fr_1.15fr_0.65fr_auto]"
                key={instrument.id}
              >
                <input
                  name="instrumentId"
                  type="hidden"
                  value={instrument.id}
                />
                <label className="grid gap-2">
                  <span className="label-text">Symbol</span>
                  <input
                    className="input"
                    defaultValue={instrument.symbol}
                    name="symbol"
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="label-text">Name</span>
                  <input
                    className="input"
                    defaultValue={instrument.name ?? ""}
                    name="name"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="label-text">Yahoo</span>
                  <input
                    className="input"
                    defaultValue={instrument.yahooSymbol ?? ""}
                    name="yahooSymbol"
                    placeholder="ES=F"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="label-text">Timezone</span>
                  <input
                    className="input"
                    defaultValue={instrument.exchangeTimezone}
                    name="exchangeTimezone"
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="label-text">Session</span>
                  <input
                    className="input"
                    defaultValue={instrument.sessionStartHour}
                    max="23"
                    min="0"
                    name="sessionStartHour"
                    required
                    type="number"
                  />
                </label>
                <div className="flex items-end">
                  <button className="ghost-button w-full" type="submit">
                    <Save aria-hidden size={15} />
                    Save
                  </button>
                </div>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
