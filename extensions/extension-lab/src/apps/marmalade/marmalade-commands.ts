import { defineCommand, type ExtensionStorageApi, l10n, params } from "@pstdio/sdk/extensions";
import type { MarmaladeAction, MarmaladeState } from "./marmalade.types";
import { createMarmaladeState } from "./marmalade-data";
import { applyMarmaladeAction } from "./marmalade-document";
import { marmaladeChanged } from "./marmalade-events";

const writes = new Map<string, Promise<MarmaladeState>>();
const read = async (storage: ExtensionStorageApi) => {
  const record = await storage.records.read(storage.records.id("marmalade:great-wave"));
  return record.exists && !record.deleted ? (record.value as unknown as MarmaladeState) : createMarmaladeState();
};
export const readMarmalade = defineCommand({
  id: "marmalade.read",
  title: l10n("commands.marmaladeRead", "Read Marmalade document"),
  cli: { path: ["marmalade", "read"] },
  async run(ctx) {
    await writes.get(ctx.projectId)?.catch(() => undefined);
    return read(ctx.storage);
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
        const next = applyMarmaladeAction(await read(ctx.storage), input.action);
        const outcome = await ctx.storage.records.commit({
          operationId: ctx.storage.ids.create(),
          edits: [
            { recordId: ctx.storage.records.id("marmalade:great-wave"), replace: JSON.parse(JSON.stringify(next)) },
          ],
        });
        if (outcome.state === "needs-attention") throw new Error(outcome.reason ?? "The document could not be saved");
        await ctx.events.emit(marmaladeChanged, {});
        return next;
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
