import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { autoBuildChanged } from "./auto-build-mode";

interface AutoBuildSupervisor {
  sessionId?: string;
  lastWake?: string;
}

export const readAutoBuildSupervisor = async (ctx: Pick<ExtensionContextBase, "storage">) =>
  (await ctx.storage.get<AutoBuildSupervisor>("auto-build-supervisor")) ?? {};

export const saveAutoBuildSupervisor = async (ctx: ExtensionContextBase, supervisor: AutoBuildSupervisor) => {
  await ctx.storage.set("auto-build-supervisor", supervisor);
  await ctx.events.emit(autoBuildChanged, {});
};
