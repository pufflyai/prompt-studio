import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import {
  createDashboardWorkspaceOptionResource,
  createDashboardWorkspaceOptions,
} from "@/shared/workspaces/workspace-options";

interface DesktopFiles {
  getAppInfo(): Promise<{ platform: string }>;
  revealInFinder(path: string): Promise<void>;
}
const desktop = () => (globalThis as typeof globalThis & { promptStudioDesktop?: DesktopFiles }).promptStudioDesktop;
const canRevealKey = "workbench.desktop.canRevealFiles";
interface HostWorkspaceServices {
  projectId: string | undefined;
  options: ReturnType<typeof createDashboardWorkspaceOptions>;
  get: ReturnType<typeof getApiClient>["workspaces"]["getByShorthand"];
}
export const canonicalWorkspaceHostResource = async (resource: ResourceRef, services: HostWorkspaceServices) => {
  const { projectId } = services;
  if (!projectId || (resource.projectId && resource.projectId !== projectId))
    throw new Error("Workspace project is unavailable.");
  const option = services.options.find((workspace) => workspace.id === resource.id);
  if (!option || option.device) throw new Error("Workspace is not on this device.");
  const workspace = await services.get(projectId, option.shorthand);
  if (
    workspace.device ||
    workspace.id !== option.id ||
    workspace.projectId !== projectId ||
    workspace.executionKind !== "local" ||
    workspace.providerState !== "ready" ||
    workspace.initializing ||
    workspace.setupError ||
    !workspace.rootPath
  )
    throw new Error("Workspace execution is unavailable.");
  const canonical: ResourceRef = {
    ...createDashboardWorkspaceOptionResource(option, projectId),
    metadata: {
      ...createDashboardWorkspaceOptionResource(option, projectId).metadata,
      workspaceId: workspace.id,
      workspacePath: workspace.rootPath,
      workspaceExecutionKind: workspace.executionKind,
      workspaceProviderState: workspace.providerState,
      workspaceSupportsFiles: workspace.capabilities?.files !== "none",
    },
  };
  return canonical;
};

export const resolveWorkspaceHostResource = async (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  const resolved = await canonicalWorkspaceHostResource(resource, {
    projectId,
    options: createDashboardWorkspaceOptions(projectId),
    get: getApiClient().workspaces.getByShorthand,
  });
  if (getDashboardSelectedProjectId(ctx) !== projectId) throw new Error("Workspace project changed.");
  return resolved;
};

/** Desktop integration stays in the host; tools supply a scoped workspace and relative entry. */
export const registerWorkspaceHostActions = (ctx: WorkbenchModuleContext) => {
  ctx.context.set(canRevealKey, false);
  void desktop()
    ?.getAppInfo()
    .then((info) => ctx.context.set(canRevealKey, info.platform === "darwin"))
    .catch(() => {});
  ctx.commands.registerCommand(
    {
      id: "workbench.workspace.revealEntry",
      label: "Reveal in Finder",
      icon: "FolderOpen",
      when: canRevealKey,
    },
    {
      execute: async (args: { path: string }, invocation) => {
        if (!invocation?.resource) throw new Error("Workspace is unavailable.");
        const resource = await resolveWorkspaceHostResource(ctx, invocation.resource);
        const entry = await getApiClient().workspaces.resolveEntry(resource.id!, args.path);
        const adapter = desktop();
        if (!adapter || (await adapter.getAppInfo()).platform !== "darwin")
          throw new Error("Reveal in Finder is unavailable.");
        await adapter.revealInFinder(entry.absolutePath);
      },
    },
  );
};
