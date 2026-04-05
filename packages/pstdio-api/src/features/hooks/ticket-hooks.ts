import type { createPluginService } from "../plugins/plugin-service";
import { withHookSessionClient } from "./hook-client";

export type FireTicketHookDeps = {
  pluginService: ReturnType<typeof createPluginService>;
};

export type FireTicketHookResult = {
  rejected: boolean;
  stderr: string;
  modifiedPayload: Record<string, unknown> | null;
};

export const fireTicketHook = async (
  deps: FireTicketHookDeps,
  hookName: string,
  projectId: string,
  payload: Record<string, unknown>,
): Promise<FireTicketHookResult> => {
  const { dispatcher, client } = await deps.pluginService.getForProject(projectId);
  const hookContext = { projectId, ...payload };
  const ctx = { ...hookContext, client: withHookSessionClient(client, hookContext) };
  const result = await dispatcher.firePreHook(hookName, ctx);

  if (result.rejected) {
    return { rejected: true, stderr: result.reason ?? "", modifiedPayload: null };
  }

  return { rejected: false, stderr: "", modifiedPayload: result.data ?? null };
};

export const fireTicketHookAsync = (
  deps: FireTicketHookDeps,
  hookName: string,
  projectId: string,
  payload: Record<string, unknown>,
) => {
  void (async () => {
    const { dispatcher, client } = await deps.pluginService.getForProject(projectId);
    const hookContext = { projectId, ...payload };
    const ctx = { ...hookContext, client: withHookSessionClient(client, hookContext) };
    await dispatcher.firePostHook(hookName, ctx);
  })().catch(() => {});
};
