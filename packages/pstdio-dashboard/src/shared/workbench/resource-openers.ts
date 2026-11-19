import { commandRefId, contributionRefId, type ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { toWorkbenchNavigationTarget } from "@pstdio/workbench/extensions";
import { relatedResourceOpeningSchema } from "pstdio-api-contracts";
import { getApiClient } from "@/lib/api";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { executeExtensionCommand } from "@/shared/extensions/api";
import { canonicalDashboardResource } from "@/shared/extensions/resource-identity";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { beginDashboardNavigation } from "./navigation-request";

export const configuredResourceOpener = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const projectId = resource.projectId ?? getDashboardSelectedProjectId(ctx);
  if (!projectId) return undefined;
  const ref = canonicalDashboardResource(resource, projectId);
  const binding = getCachedDashboardExtensionMetadata(projectId)?.composition?.resourceOpeners.find(
    ({ resourceKind }) => resourceKind.extensionId === ref.extensionId && resourceKind.id === ref.type,
  );
  if (!binding) return undefined;
  const opener = binding.opener;
  const available =
    opener.kind === "command"
      ? ctx.commands.getCommand(commandRefId(opener))
      : ctx.pages.listPages().find((page) => page.ref.extensionId === opener.extensionId && page.ref.id === opener.id);
  return available ? binding : undefined;
};

export const resolveDashboardResourceOpening = async (
  ctx: WorkbenchModuleContext,
  resource: ResourceRef,
  signal?: AbortSignal,
) => {
  const projectId = resource.projectId ?? getDashboardSelectedProjectId(ctx);
  if (!projectId) throw new Error("Resource opening requires a project");
  const [opening] = await getApiClient().projects.resolveResourceOpenings(
    projectId,
    [canonicalDashboardResource(resource, projectId)],
    { signal },
  );
  if (!opening?.target) throw new Error("The configured resource opener is unavailable");
  return opening;
};

export const openDashboardResource = async (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId || (resource.projectId && resource.projectId !== projectId)) return;
  const request = beginDashboardNavigation(ctx, projectId);
  try {
    const opening = await resolveDashboardResourceOpening(ctx, resource, request.signal);
    if (!request.isCurrent()) return;
    await ctx.navigation.openTarget(toWorkbenchNavigationTarget(opening.target!));
  } catch (error) {
    if (request.isCurrent()) throw error;
  } finally {
    request.dispose();
  }
};

export const configuredRelatedOpenings = async (
  ctx: WorkbenchModuleContext,
  source: ResourceRef,
  signal: AbortSignal,
) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId || (source.projectId && source.projectId !== projectId)) return [];
  const resource = canonicalDashboardResource(source, projectId);
  const binding = configuredResourceOpener(ctx, resource);
  if (!binding?.relatedOpenings) return [];
  const ref = binding.relatedOpenings;
  const commandId = commandRefId(ref);
  const command = ctx.commands.getCommand(commandId);
  if (!command) return [];
  const response = await executeExtensionCommand(projectId, commandId, { resource, source: "dashboard" }, signal);
  signal.throwIfAborted();
  const current = configuredResourceOpener(ctx, resource);
  if (
    getDashboardSelectedProjectId(ctx) !== projectId ||
    !current?.relatedOpenings ||
    commandRefId(current.relatedOpenings) !== commandId ||
    contributionRefId(current.opener) !== contributionRefId(binding.opener) ||
    ctx.commands.getCommand(commandId) !== command
  )
    return [];
  if (!response.outcome.ok) return [];
  return relatedResourceOpeningSchema
    .array()
    .parse(response.outcome.value)
    .map((opening) => ({
      ...opening,
      resource: {
        ...opening.resource,
        projectId: opening.resource.projectId ?? projectId,
        extensionId: opening.resource.extensionId ?? ref.extensionId,
      },
    }));
};
