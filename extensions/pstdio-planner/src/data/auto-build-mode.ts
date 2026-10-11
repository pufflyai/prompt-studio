import { type ExtensionContextBase, eventRef } from "@pstdio/sdk/extensions";

export interface AutoBuildMode {
  revision: string;
  enabled: boolean;
}

export const autoBuildChanged = eventRef({ extensionId: "pstdio.pstdio-planner", id: "auto-build.changed" });
export const readAutoBuildMode = async (ctx: Pick<ExtensionContextBase, "storage">) => {
  const mode = (await ctx.storage.get<AutoBuildMode>("auto-build")) ?? {
    revision: "",
    enabled: false,
  };
  const failure = await ctx.storage.get<{ revision: string }>("auto-build-failure");
  return { revision: mode.revision, enabled: mode.enabled && failure?.revision !== mode.revision };
};

export const pauseAutoBuildMode = async (ctx: ExtensionContextBase, mode: AutoBuildMode) => {
  // Failure belongs to the batch's configuration. A later configuration stays enabled.
  await ctx.storage.set("auto-build-failure", { revision: mode.revision });
  await ctx.events.emit(autoBuildChanged, {});
};

export const saveAutoBuildMode = async (ctx: ExtensionContextBase, mode: AutoBuildMode) => {
  await ctx.storage.set("auto-build", mode);
  await ctx.events.emit(autoBuildChanged, {});
  return mode;
};
