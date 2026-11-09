import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import type { MarmaladeAction } from "./marmalade.types";
import { marmaladeEditingState } from "./marmalade-editing-state";
import { marmaladeChanged } from "./marmalade-events";
import { importMarmaladeLegacy } from "./marmalade-migration";
import { marmaladePresentationResult, mutateMarmalade } from "./marmalade-mutations";
import {
  inMarmaladeOrder,
  marmaladeJson,
  marmaladeKeys,
  marmaladeViewState,
  readMarmaladeDocument,
  readMarmaladePresentationRecord,
} from "./marmalade-storage";

const action = params.json<MarmaladeAction, { required: true }>({ required: true });
export const readMarmalade = defineCommand({
  id: "marmalade.read",
  title: l10n("commands.marmaladeRead", "Read Marmalade document"),
  cli: { path: ["marmalade", "read"] },
  run: (ctx) =>
    inMarmaladeOrder(ctx.projectId, async () => {
      await importMarmaladeLegacy(ctx.storage);
      const current = await readMarmaladeDocument(ctx.storage);
      return marmaladeViewState(current.state, current.history);
    }),
});
export const editMarmalade = defineCommand({
  id: "marmalade.edit",
  title: l10n("commands.marmaladeEdit", "Edit Marmalade document"),
  cli: { path: ["marmalade", "edit"] },
  mutating: true,
  params: { action },
  run: (ctx, input) =>
    inMarmaladeOrder(ctx.projectId, async () => {
      await mutateMarmalade(ctx, input.action, ctx.storage.ids.create());
      // Older callers explicitly request the composed document response.
      const current = await readMarmaladeDocument(ctx.storage);
      return marmaladeViewState(current.state, current.history);
    }),
});
export const loadMarmalade = defineCommand({
  id: "marmalade.session.read",
  title: l10n("commands.marmaladeRead", "Read Marmalade document"),
  cli: { path: ["marmalade", "session", "read"] },
  run: (ctx) =>
    inMarmaladeOrder(ctx.projectId, async () => {
      await importMarmaladeLegacy(ctx.storage);
      const current = await readMarmaladeDocument(ctx.storage);
      return {
        value: marmaladeJson(marmaladeEditingState(marmaladeViewState(current.state, current.history))),
        sources: [
          {
            id: "document",
            read: { commandId: `${ctx.extensionId}.command.marmalade.session.read` },
            dependsOn: [marmaladeChanged],
            dependency: {
              recordIds: [marmaladeKeys.document, marmaladeKeys.history, marmaladeKeys.legacy].map(
                ctx.storage.records.id,
              ),
            },
          },
          {
            id: "presentation",
            read: { commandId: `${ctx.extensionId}.command.marmalade.presentation.read` },
            dependsOn: [marmaladeChanged],
            dependency: { recordId: ctx.storage.records.id(marmaladeKeys.presentation) },
          },
        ],
      };
    }),
});
export const readMarmaladePresentation = defineCommand({
  id: "marmalade.presentation.read",
  title: l10n("commands.marmaladePresentationRead", "Read Marmalade presentation"),
  cli: { path: ["marmalade", "presentation", "read"] },
  run: (ctx) =>
    inMarmaladeOrder(ctx.projectId, async () =>
      marmaladePresentationResult((await readMarmaladePresentationRecord(ctx.storage)).values),
    ),
});
export const executeMarmalade = defineCommand({
  id: "marmalade.session.execute",
  title: l10n("commands.marmaladeEdit", "Edit Marmalade document"),
  cli: { path: ["marmalade", "session", "execute"] },
  mutating: true,
  params: { action, operationId: params.text() },
  run: (ctx, input) =>
    inMarmaladeOrder(ctx.projectId, () =>
      mutateMarmalade(ctx, input.action, input.operationId ?? ctx.storage.ids.create()),
    ),
});
export const marmaladeCommands = {
  "marmalade.read": readMarmalade,
  "marmalade.edit": editMarmalade,
  "marmalade.session.read": loadMarmalade,
  "marmalade.presentation.read": readMarmaladePresentation,
  "marmalade.session.execute": executeMarmalade,
};
