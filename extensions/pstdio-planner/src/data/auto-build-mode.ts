import { type ExtensionContextBase, eventRef, type StorageGroup, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import { seedDefaultStatuses } from "./seed";
import { withWriteGuard } from "./write-guard";

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

export const readAutoBuildMode = async (ctx: Pick<ExtensionContextBase, "storage">) => {
  const mode = await ctx.storage.get<AutoBuildMode>("auto-build");
  return {
    revision: mode?.revision ?? "",
    enabled: Boolean(mode?.enabled && mode.prompt),
    prompt: mode?.prompt ?? "",
    ignore: mode?.ignore ?? (await defaultAutoBuildIgnore(ctx)),
    blockOnReview: mode?.blockOnReview ?? true,
  };
};

export const pauseAutoBuildMode = async (ctx: ExtensionContextBase, mode: AutoBuildMode) => {
  await withWriteGuard(
    ctx,
    "auto-build-mode",
    async () => {
      const current = await readAutoBuildMode(ctx);
      if (current.revision === mode.revision) await saveAutoBuildMode(ctx, { ...current, enabled: false });
    },
    () => undefined,
  );
};

export const saveAutoBuildMode = async (
  ctx: ExtensionContextBase,
  mode: AutoBuildMode,
  relatedEdits: StorageGroup["edits"] = [],
) => {
  await ctx.storage.records.commit({
    operationId: crypto.randomUUID(),
    edits: [{ recordId: ctx.storage.records.id("auto-build"), replace: { ...mode } }, ...relatedEdits],
  });
  await ctx.events.emit(autoBuildChanged, {});
  return mode;
};
