import type { ExtensionsRouteDeps } from "../extensions/deps";
import { dispatchProjectExtensionEvent } from "../extensions/extension-command-runtime";
import type { createPluginService } from "../plugins/plugin-service";
import { withHookSessionClient } from "./hook-client";

export type FireTicketHookDeps = {
  pluginService: ReturnType<typeof createPluginService>;
} & Partial<ExtensionsRouteDeps>;

export type FireTicketHookResult = {
  rejected: boolean;
  stderr: string;
  modifiedPayload: Record<string, unknown> | null;
};

const rejectFromDiagnostics = (diagnostics: { message: string }[] | undefined): FireTicketHookResult | null => {
  if (!diagnostics?.length) return null;
  return {
    rejected: true,
    stderr: diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    modifiedPayload: null,
  };
};

export const fireTicketHook = async (
  deps: FireTicketHookDeps,
  hookName: string,
  projectId: string,
  payload: Record<string, unknown>,
): Promise<FireTicketHookResult> => {
  const runtime = await deps.pluginService.getForProject(projectId);
  const hookContext = { projectId, ...payload };
  const ctx = { ...hookContext, client: withHookSessionClient(runtime.client, hookContext) };
  const result = await runtime.hooks.firePre(hookName as never, ctx as never);

  if (result.rejected) {
    return { rejected: true, stderr: result.reason ?? "", modifiedPayload: null };
  }

  if (deps.extensionService) {
    const extensionResult = await dispatchProjectExtensionEvent(
      deps as ExtensionsRouteDeps,
      projectId,
      `kernel.${hookName}`,
      hookContext,
    );
    const rejected = rejectFromDiagnostics(extensionResult.diagnostics);
    if (rejected) return rejected;
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
    const runtime = await deps.pluginService.getForProject(projectId);
    const hookContext = { projectId, ...payload };
    const ctx = { ...hookContext, client: withHookSessionClient(runtime.client, hookContext) };
    await runtime.hooks.firePost(hookName as never, ctx as never);
    if (deps.extensionService) {
      await dispatchProjectExtensionEvent(deps as ExtensionsRouteDeps, projectId, `kernel.${hookName}`, hookContext);
    }
  })().catch(() => {});
};
