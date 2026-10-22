import {
  type ExtensionContextBase,
  type ExtensionHarnessInput,
  eventRef,
  type StorageGroup,
  type ViewFilterGroup,
} from "@pstdio/sdk/extensions";
import { withWriteGuard } from "./write-guard";

export interface AutoBuildMode {
  revision: string;
  enabled: boolean;
  prompt: string;
  supervisorModel?: ExtensionHarnessInput;
  /** @deprecated Use requireMergedDependencies. Review evidence is optional. */
  blockOnReview: boolean;
  eligible: ViewFilterGroup;
  requireMergedDependencies: boolean;
}

export const autoBuildChanged = eventRef({ extensionId: "pstdio.pstdio-planner", id: "auto-build.changed" });

export const readAutoBuildMode = async (ctx: Pick<ExtensionContextBase, "storage">) => {
  const mode = await ctx.storage.get<AutoBuildMode>("auto-build");
  return {
    revision: mode?.revision ?? "",
    enabled: Boolean(mode?.enabled && mode.prompt && mode.eligible),
    prompt: mode?.prompt ?? "",
    supervisorModel: mode?.supervisorModel,
    blockOnReview: mode?.blockOnReview ?? false,
    eligible: mode?.eligible ?? { conjunction: "and" as const, rules: [] },
    requireMergedDependencies: mode?.requireMergedDependencies ?? false,
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
    edits: [
      { recordId: ctx.storage.records.id("auto-build"), replace: JSON.parse(JSON.stringify(mode)) },
      ...relatedEdits,
    ],
  });
  await ctx.events.emit(autoBuildChanged, {});
  return mode;
};
