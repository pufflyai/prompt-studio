import type { CommandContext } from "@pstdio/sdk/extensions";
import type { MarmaladeAction } from "./marmalade.types";
import { marmaladeEditingChanges, marmaladeEditingState } from "./marmalade-editing-state";
import { marmaladeChanged } from "./marmalade-events";
import { applyMarmaladeHistory } from "./marmalade-history";
import {
  applyMarmaladePresentation,
  isMarmaladePresentationAction,
  marmaladePresentation,
} from "./marmalade-presentation";
import {
  assertMarmaladeSaved,
  marmaladeDocumentEdits,
  marmaladeJson,
  marmaladeKeys,
  marmaladePresentationEdits,
  marmaladePresentationRecord,
  marmaladeViewState,
  readMarmaladeDocument,
  readMarmaladePresentationRecord,
} from "./marmalade-storage";

export const marmaladePresentationResult = (
  values: Awaited<ReturnType<typeof readMarmaladePresentationRecord>>["values"],
) => ({ changes: Object.entries(values).map(([key, value]) => ({ path: [key], value })), sourceIds: ["presentation"] });
const emitMarmaladeChange = (ctx: CommandContext, keys: (keyof typeof marmaladeKeys)[]) =>
  ctx.events.emit(
    marmaladeChanged,
    {},
    {
      refresh: {
        extensionId: ctx.extensionId,
        recordIds: keys.map((key) => ctx.storage.records.id(marmaladeKeys[key])),
      },
    },
  );
const currentResult = async (ctx: CommandContext, presentation: boolean) => {
  if (presentation) return marmaladePresentationResult((await readMarmaladePresentationRecord(ctx.storage)).values);
  const current = await readMarmaladeDocument(ctx.storage);
  return {
    value: marmaladeJson(marmaladeEditingState(marmaladeViewState(current.state, current.history))),
    sourceIds: ["presentation"],
  };
};

/** The same domain authority serves CLI commands and command-backed shared sessions. */
export const mutateMarmalade = async (
  ctx: CommandContext,
  action: MarmaladeAction,
  operationId: string,
  historyBoundary?: string,
) => {
  const presentationOnly = isMarmaladePresentationAction(action);
  const previous = await ctx.storage.records.outcome(operationId);
  if (previous) {
    assertMarmaladeSaved(previous);
    const result = await currentResult(ctx, presentationOnly);
    await emitMarmaladeChange(ctx, presentationOnly ? ["presentation"] : ["document", "history", "presentation"]);
    return result;
  }
  if (presentationOnly) {
    const record = await readMarmaladePresentationRecord(ctx.storage);
    const values = applyMarmaladePresentation(record.values, record.layers, action);
    assertMarmaladeSaved(
      await ctx.storage.records.commit({
        operationId,
        edits: [
          {
            recordId: ctx.storage.records.id(marmaladeKeys.presentation),
            set: {
              "/version": 1,
              ...marmaladePresentationEdits(record.values, values),
            },
          },
        ],
      }),
    );
    await emitMarmaladeChange(ctx, ["presentation"]);
    return marmaladePresentationResult((await readMarmaladePresentationRecord(ctx.storage)).values);
  }
  const current = await readMarmaladeDocument(ctx.storage);
  // A pointer-up already in flight must not resurrect a gesture cancelled by undo/redo.
  // Accepted operation retries above remain idempotent across later history boundaries.
  if (historyBoundary !== undefined && historyBoundary !== current.history.boundary)
    return {
      value: marmaladeJson(marmaladeEditingState(marmaladeViewState(current.state, current.history))),
      sourceIds: ["presentation"],
    };
  const next = applyMarmaladeHistory(current.state, current.history, action);
  if (action.type === "undo" || action.type === "redo") next.history = { ...next.history, boundary: operationId };
  const presentation = marmaladePresentationRecord(next.state);
  assertMarmaladeSaved(
    await ctx.storage.records.commit({
      operationId,
      edits: [
        {
          recordId: ctx.storage.records.id(marmaladeKeys.document),
          set: { "/version": 2, ...marmaladeDocumentEdits(current.state.document, next.state.document) },
        },
        { recordId: ctx.storage.records.id(marmaladeKeys.history), replace: marmaladeJson(next.history) },
        {
          recordId: ctx.storage.records.id(marmaladeKeys.presentation),
          set: {
            "/version": 1,
            "/documentId": presentation.documentId,
            "/layers": marmaladeJson({ layers: presentation.layers }).layers,
            ...marmaladePresentationEdits(marmaladePresentation(current.state), presentation.values),
          },
        },
      ],
    }),
  );
  await emitMarmaladeChange(ctx, ["document", "history", "presentation"]);
  const acceptedPresentation = await readMarmaladePresentationRecord(ctx.storage);
  return {
    changes: [
      ...marmaladeEditingChanges(
        marmaladeViewState(current.state, current.history),
        marmaladeViewState(next.state, next.history),
      ),
      ...marmaladePresentationResult(acceptedPresentation.values).changes,
    ],
    // Record saves return receipts, not atomic accepted values. Keep one common document
    // reconciliation read so a concurrent participant's unrelated fields stay current.
    sourceIds: ["presentation"],
  };
};
