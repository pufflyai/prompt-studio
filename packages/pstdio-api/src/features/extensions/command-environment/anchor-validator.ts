import type { JsonObject, ResourceAnchorValidationInput, ResourceRef } from "pstdio-api-contracts/extension-kernel";
import { createCommandRunner } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { resolveCommandWorkspaceDir } from "../execute-project-extension-command";
import { createCommandEnvironment } from "./index";

const rejectLinkMutation = async (): Promise<never> => {
  throw new Error("Anchor validators cannot mutate resource links.");
};

export const runAnchorValidator = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  commandId: string,
  resource: ResourceRef,
  params: ResourceAnchorValidationInput,
) => {
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  const workspace = await deps.workspaceService.getDefault(projectId);
  const runner = createCommandRunner(snapshot.runtime, {
    buildEnvironment: (input) => {
      const environment = createCommandEnvironment(deps, snapshot.enabledSources, {
        ...input,
        project: snapshot.project,
        settings: snapshot.runtime.settings,
      });
      const scoped = (apis: ReturnType<typeof environment.withScope>) => ({
        ...apis,
        workspaces: {
          ...apis.workspaces,
          create: rejectLinkMutation,
          addAnchors: rejectLinkMutation,
          removeAnchors: rejectLinkMutation,
          delete: rejectLinkMutation,
        },
        sessions: {
          ...apis.sessions,
          create: rejectLinkMutation,
          addAnchors: rejectLinkMutation,
          removeAnchors: rejectLinkMutation,
        },
      });
      return {
        ...environment,
        ...scoped(environment),
        resources: {
          ...environment.resources,
          addAnchors: rejectLinkMutation,
          removeAnchors: rejectLinkMutation,
          removed: rejectLinkMutation,
        },
        withScope: (scope) => scoped(environment.withScope(scope)),
      };
    },
  });
  const outcome = await runner.execute({
    commandId,
    projectId,
    resource,
    params: params as unknown as JsonObject,
    source: "api",
    workspaceId: workspace?.id,
    workspaceDir: workspace ? resolveCommandWorkspaceDir(workspace) : undefined,
  });
  if (!outcome.ok) throw new Error(outcome.reason);
  const verdict = outcome.value as { allowed?: boolean; reason?: string } | undefined;
  if (verdict?.allowed !== true) throw new Error(verdict?.reason ?? "Anchor change was rejected by its owner.");
};
