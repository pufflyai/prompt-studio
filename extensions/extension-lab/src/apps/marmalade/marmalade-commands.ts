import { defineCommand, type ExtensionStorageApi, l10n, params } from "@pstdio/sdk/extensions";
import type { MarmaladeAction, MarmaladeState, MarmaladeViewState } from "./marmalade.types";
import { createMarmaladeState } from "./marmalade-data";
import { marmaladeChanged } from "./marmalade-events";
import { applyMarmaladeHistory, type MarmaladeHistory } from "./marmalade-history";

const writes = new Map<string, Promise<MarmaladeViewState>>();
const read = async (storage: ExtensionStorageApi) => {
  const [record, savedHistory] = await Promise.all([
    storage.records.read(storage.records.id("marmalade:great-wave")),
    storage.records.read(storage.records.id("marmalade:history")),
  ]);
  const state = record.exists && !record.deleted ? (record.value as unknown as MarmaladeState) : createMarmaladeState();
  const history: MarmaladeHistory =
    savedHistory.exists && !savedHistory.deleted
      ? (savedHistory.value as unknown as MarmaladeHistory)
      : { past: [], future: [] };
  return { state, history };
};
const viewState = (state: MarmaladeState, history: MarmaladeHistory) => ({
  ...state,
  history: { undo: history.past.length, redo: history.future.length },
});
export const readMarmalade = defineCommand({
  id: "marmalade.read",
  title: l10n("commands.marmaladeRead", "Read Marmalade document"),
  cli: { path: ["marmalade", "read"] },
  async run(ctx) {
    await writes.get(ctx.projectId)?.catch(() => undefined);
    const { state, history } = await read(ctx.storage);
    return viewState(state, history);
  },
});
export const editMarmalade = defineCommand({
  id: "marmalade.edit",
  title: l10n("commands.marmaladeEdit", "Edit Marmalade document"),
  cli: { path: ["marmalade", "edit"] },
  mutating: true,
  params: { action: params.json<MarmaladeAction, { required: true }>({ required: true }) },
  async run(ctx, input) {
    // Each command validates against the last committed document, including edits from other webviews.
    const pending = (writes.get(ctx.projectId) ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const { state, history } = await read(ctx.storage);
        const next = applyMarmaladeHistory(state, history, input.action);
        const outcome = await ctx.storage.records.commit({
          operationId: ctx.storage.ids.create(),
          edits: [
            {
              recordId: ctx.storage.records.id("marmalade:great-wave"),
              replace: JSON.parse(JSON.stringify(next.state)),
            },
            {
              recordId: ctx.storage.records.id("marmalade:history"),
              replace: JSON.parse(JSON.stringify(next.history)),
            },
          ],
        });
        if (outcome.state === "needs-attention") throw new Error(outcome.reason ?? "The document could not be saved");
        await ctx.events.emit(marmaladeChanged, {});
        return viewState(next.state, next.history);
      });
    writes.set(ctx.projectId, pending);
    try {
      return await pending;
    } finally {
      if (writes.get(ctx.projectId) === pending) writes.delete(ctx.projectId);
    }
  },
});
export const marmaladeCommands = { "marmalade.read": readMarmalade, "marmalade.edit": editMarmalade };
