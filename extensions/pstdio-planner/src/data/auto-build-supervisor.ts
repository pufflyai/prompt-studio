import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { autoBuildChanged } from "./auto-build-mode";

export interface NextTicketQuery {
  track?: string;
  status?: string;
  tags?: string[];
  parent?: string;
}

interface AutoBuildSupervisor {
  sessionId?: string;
  lastWake?: string;
  pendingWakeRevision?: string;
  scope?: { revision: string; queries: NextTicketQuery[] };
}

export const readAutoBuildSupervisor = async (ctx: Pick<ExtensionContextBase, "storage" | "resources">) =>
  (await ctx.storage.get<AutoBuildSupervisor>("auto-build-supervisor")) ?? {};

export const saveAutoBuildSupervisor = async (ctx: ExtensionContextBase, supervisor: AutoBuildSupervisor) => {
  await ctx.storage.set("auto-build-supervisor", supervisor);
  await ctx.events.emit(autoBuildChanged, {});
};

export const acknowledgeAutoBuildWake = async (ctx: ExtensionContextBase, supervisor: AutoBuildSupervisor) => {
  if (!supervisor.pendingWakeRevision) return;
  const { pendingWakeRevision: _pending, ...acknowledged } = supervisor;
  await saveAutoBuildSupervisor(ctx, acknowledged);
};
