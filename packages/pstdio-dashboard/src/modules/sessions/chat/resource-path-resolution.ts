import { isNavigationTarget, qualifyNavigationTarget, type ResourceResolution } from "@pstdio/sdk/extensions";
import { extensionResourceRefSchema } from "pstdio-api-contracts";

interface ResourcePathKind {
  id: string;
  extensionId: string;
  icon?: string;
  paths?: Array<{ prefix: string; resolveCommand: string }>;
}

interface ResourcePathInput {
  projectId: string;
  workspaceId: string;
  path: string;
  kinds: ResourcePathKind[];
  execute(command: string, params: { path: string; workspaceId: string }): Promise<unknown>;
}

export const resolveResourcePath = async (input: ResourcePathInput) => {
  const handlers = input.kinds.flatMap((kind) => (kind.paths ?? []).map((path) => ({ ...path, kind })));
  const handler = handlers
    .filter(({ prefix }) => {
      const base = prefix.replace(/\/+$/, "");
      return input.path === base || input.path.startsWith(`${base}/`);
    })
    .sort((left, right) => right.prefix.length - left.prefix.length)[0];
  if (!handler) return null;
  const value = await input.execute(handler.resolveCommand, { path: input.path, workspaceId: input.workspaceId });
  if (value === null || value === undefined) return null;
  const result = value as ResourceResolution;
  const resource = extensionResourceRefSchema.parse(result.resource);
  if (
    resource.type !== handler.kind.id ||
    (resource.extensionId && resource.extensionId !== handler.kind.extensionId) ||
    (resource.projectId && resource.projectId !== input.projectId)
  )
    throw new Error("The path handler returned a resource outside its owner or project.");
  if (
    !result.target ||
    !isNavigationTarget(result.target) ||
    !["page", "panel", "compound"].includes(result.target.kind)
  )
    throw new Error("The path handler did not return a resource destination.");
  return {
    resource: {
      ...resource,
      icon: resource.icon ?? handler.kind.icon,
      extensionId: handler.kind.extensionId,
      projectId: input.projectId,
    },
    target: qualifyNavigationTarget(result.target, handler.kind.extensionId, input.projectId),
  };
};
