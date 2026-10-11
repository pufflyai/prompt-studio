import { type ExtensionContextBase, eventRef, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import { filterRowsByView } from "@pstdio/ui/collection-view";
import type { readPlanCommand } from "../timeline/commands/read-plan";
import { timelineQueryData } from "../timeline/model/query-data";
import { autoBuildFiltersAvailable } from "./auto-build-filters";

export interface AutoBuildMode {
  revision: string;
  enabled: boolean;
  filter: ViewFilterGroup;
}

export const autoBuildChanged = eventRef({ extensionId: "pstdio.pstdio-planner", id: "auto-build.changed" });
export const readAutoBuildMode = async (ctx: Pick<ExtensionContextBase, "storage">) => {
  const mode = (await ctx.storage.get<AutoBuildMode>("auto-build")) ?? {
    revision: "",
    enabled: false,
    filter: { conjunction: "and", rules: [] },
  };
  const failure = await ctx.storage.get<{ revision: string }>("auto-build-failure");
  return { ...mode, enabled: mode.enabled && failure?.revision !== mode.revision };
};

export const pauseAutoBuildMode = async (ctx: ExtensionContextBase, mode: AutoBuildMode) => {
  // Failure belongs to the batch's configuration. A later selection stays enabled.
  await ctx.storage.set("auto-build-failure", { revision: mode.revision });
  await ctx.events.emit(autoBuildChanged, {});
};

export const saveAutoBuildMode = async (ctx: ExtensionContextBase, mode: AutoBuildMode) => {
  await ctx.storage.set("auto-build", mode);
  await ctx.events.emit(autoBuildChanged, {});
  return mode;
};

export const matchingAutoBuildIds = (mode: AutoBuildMode, plan: Awaited<ReturnType<typeof readPlanCommand.run>>) => {
  const { rows, attributes } = timelineQueryData(plan, (key, fallback) => fallback ?? key);
  if (!autoBuildFiltersAvailable(mode.filter, attributes))
    throw new Error(
      "Auto build filters are no longer valid. Review the current timeline filters and turn Auto build on again.",
    );
  return new Set(filterRowsByView(rows, mode.filter, attributes).map(({ id }) => id));
};
