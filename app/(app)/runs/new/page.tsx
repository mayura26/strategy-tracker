import Link from "next/link";

import { ImportRunForm } from "@/components/import-run-form";
import { listBotsWithModes, listInstruments } from "@/lib/db/repository";

export default async function NewRunPage() {
  const [bots, instruments] = await Promise.all([
    listBotsWithModes(),
    listInstruments(),
  ]);
  const canImport = bots.some((bot) => bot.modes.length > 0);
  const hasInstruments = instruments.length > 0;

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>Import run</h1>
          <p>
            Select a curated bot and mode, then upload the NinjaTrader Strategy
            Analyzer trade summary export.
          </p>
        </div>
      </section>

      {canImport && hasInstruments ? (
        <ImportRunForm bots={bots} instruments={instruments} />
      ) : (
        <section className="panel grid min-h-80 place-items-center text-center">
          <div>
            <p className="empty-title text-lg font-semibold">
              Create a bot, mode, and instrument first.
            </p>
            <p className="quiet-text mt-2 text-sm">
              Runs use curated records so imports stay consistent.
            </p>
            <Link className="primary-button mt-6" href="/settings">
              Open settings
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
