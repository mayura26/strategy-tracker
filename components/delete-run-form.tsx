"use client";

import { Trash2 } from "lucide-react";
import type { FormEvent } from "react";

import { deleteRunsAction } from "@/app/actions";

export function DeleteRunForm({
  runId,
  runName,
}: {
  runId: string;
  runName: string;
}) {
  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(
        `Delete "${runName}"? Trades, import data, and golden baseline links for this run will be removed. This cannot be undone.`,
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteRunsAction} onSubmit={confirmDelete}>
      <input name="runId" type="hidden" value={runId} />
      <button
        className="ghost-button border border-rose-500/40 bg-rose-950/30 text-rose-100 hover:bg-rose-950/45"
        type="submit"
      >
        <Trash2 aria-hidden size={16} />
        Delete this run
      </button>
    </form>
  );
}
