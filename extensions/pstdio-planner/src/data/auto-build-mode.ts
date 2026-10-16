import {
  type ExtensionContextBase,
  eventRef,
  type StorageGroup,
  type StorageRecord,
  type ViewFilterGroup,
} from "@pstdio/sdk/extensions";
import { seedDefaultStatuses } from "./seed";

export interface AutoBuildMode {
  revision: string;
  enabled: boolean;
  prompt: string;
  ignore: ViewFilterGroup;
  blockOnReview: boolean;
}

export const autoBuildChanged = eventRef({ extensionId: "pstdio.pstdio-planner", id: "auto-build.changed" });

export const defaultAutoBuildIgnore = async (ctx: Pick<ExtensionContextBase, "storage">) => ({
  conjunction: "and" as const,
  rules: [
    {
      attributeId: "status",
      condition: "is-any-of" as const,
      value: (await seedDefaultStatuses(ctx.storage))
        .filter(({ name }) => ["backlog", "done"].includes(name.trim().toLowerCase()))
        .map(({ id }) => id),
    },
  ],
});

export const readAutoBuildModeSnapshot = async (ctx: Pick<ExtensionContextBase, "storage">) => {
  const record = await ctx.storage.records.read(ctx.storage.records.id("auto-build"));
  const mode = record.deleted ? null : (record.value as AutoBuildMode | null);
  return {
    record,
    mode: {
      revision: mode?.revision ?? "",
      enabled: Boolean(mode?.enabled && mode.prompt),
      prompt: mode?.prompt ?? "",
      ignore: mode?.ignore ?? (await defaultAutoBuildIgnore(ctx)),
      blockOnReview: mode?.blockOnReview ?? true,
    },
  };
};

export const readAutoBuildMode = async (ctx: Pick<ExtensionContextBase, "storage">) =>
  (await readAutoBuildModeSnapshot(ctx)).mode;

export const pauseAutoBuildMode = async (ctx: ExtensionContextBase, mode: AutoBuildMode) => {
  const current = await readAutoBuildModeSnapshot(ctx);
  if (current.mode.revision === mode.revision)
    return saveAutoBuildMode(ctx, { ...current.mode, enabled: false }, current.record);
};

export const saveAutoBuildMode = async (
  ctx: ExtensionContextBase,
  mode: AutoBuildMode,
  observed: StorageRecord,
  relatedEdits: StorageGroup["edits"] = [],
) => {
  const storageOutcome = await ctx.storage.records.commit({
    operationId: crypto.randomUUID(),
    edits: [
      { recordId: observed.recordId, expectedRevision: observed.revision, replace: { ...mode } },
      ...relatedEdits,
    ],
  });
  if (storageOutcome.status !== "conflict") await ctx.events.emit(autoBuildChanged, {});
  return { ...mode, storageOutcome };
};
