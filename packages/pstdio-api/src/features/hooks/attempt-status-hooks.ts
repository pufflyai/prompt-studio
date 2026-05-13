import type { EventDeliveryResult } from "@pstdio/sdk/extensions";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { dispatchProjectExtensionEvent } from "../extensions/extension-command-runtime";
import type { createPluginService } from "../plugins/plugin-service";
import { withHookSessionClient } from "./hook-client";

type AttemptStatusHookDeps = {
  pluginService: ReturnType<typeof createPluginService>;
  dispatchExtensionEvent?: typeof dispatchProjectExtensionEvent;
} & Partial<ExtensionsRouteDeps>;

const rejectFromDiagnostics = (diagnostics: EventDeliveryResult["diagnostics"] | undefined): PreHookResult | null => {
  if (!diagnostics?.length) return null;
  return { rejected: true, stderr: diagnostics.map((diagnostic) => diagnostic.message).join("\n"), stdout: "" };
};

const dispatchExtensionHook = (
  deps: AttemptStatusHookDeps,
  projectId: string,
  hookName: string,
  payload: Record<string, unknown>,
) => {
  if (!deps.extensionService && !deps.dispatchExtensionEvent) return null;
  const dispatch = deps.dispatchExtensionEvent ?? dispatchProjectExtensionEvent;
  return dispatch(deps as ExtensionsRouteDeps, projectId, `kernel.${hookName}`, payload);
};

type PreHookContext = {
  projectId: string;
  fromStatus: string;
  toStatus: string;
  payload: Record<string, unknown>;
};

type PreHookResult = {
  rejected: boolean;
  stderr: string;
  stdout: string;
};

type PostHookContext = {
  projectId: string;
  toStatus: string;
  payload: Record<string, unknown>;
};

export const firePreAttemptStatusHook = async (
  deps: AttemptStatusHookDeps,
  context: PreHookContext,
): Promise<PreHookResult> => {
  const runtime = await deps.pluginService.getForProject(context.projectId);

  const hookContext = {
    projectId: context.projectId,
    fromStatus: context.fromStatus,
    toStatus: context.toStatus,
    ...context.payload,
  };

  const ctx = {
    ...hookContext,
    client: withHookSessionClient(runtime.client, hookContext),
  };

  const result = await runtime.hooks.firePre("preAttemptStatusChange", ctx as never);

  if (result.rejected) {
    return { rejected: true, stderr: result.reason ?? "", stdout: "" };
  }

  const extensionResult = await dispatchExtensionHook(deps, context.projectId, "preAttemptStatusChange", hookContext);
  const rejected = rejectFromDiagnostics(extensionResult?.diagnostics);
  if (rejected) return rejected;

  return { rejected: false, stderr: "", stdout: "" };
};

export const firePostAttemptStatusHook = async (deps: AttemptStatusHookDeps, context: PostHookContext) => {
  const runtime = await deps.pluginService.getForProject(context.projectId);

  const hookContext = {
    projectId: context.projectId,
    toStatus: context.toStatus,
    ...context.payload,
  };

  const ctx = {
    ...hookContext,
    client: withHookSessionClient(runtime.client, hookContext),
  };

  await runtime.hooks.firePost("postAttemptStatusChange", ctx as never);
  await dispatchExtensionHook(deps, context.projectId, "postAttemptStatusChange", hookContext);
};
