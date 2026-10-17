import {
  type FileSourcePosition,
  isNavigationTarget,
  type NavigationTarget,
  type NavigationTargetPage,
  type ResourceResolution,
} from "@pstdio/sdk/extensions";
import { extensionResourceRefSchema, qualifyNavigationTarget } from "pstdio-api-contracts";

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
  position?: FileSourcePosition;
  execute(command: string, params: { path: string; workspaceId: string }): Promise<unknown>;
}

const scopedResource = (value: unknown, extensionId: string, projectId: string) => {
  const resource = extensionResourceRefSchema.parse(value);
  if (
    (resource.extensionId !== undefined && resource.extensionId !== extensionId) ||
    (resource.projectId !== undefined && resource.projectId !== projectId)
  )
    throw new Error("The path handler returned a resource outside its owner or project.");
  return resource;
};

const positionedPage = (target: NavigationTargetPage, position: FileSourcePosition) => ({
  ...target,
  section: undefined,
  position,
});

const withSourcePosition = (target: NavigationTarget, position?: FileSourcePosition) => {
  if (!position) return target;
  if (target.kind === "page") return positionedPage(target, position);
  if (target.kind === "compound")
    return {
      ...target,
      targets: target.targets.map((item) => (item.kind === "page" ? positionedPage(item, position) : item)),
    };
  return target;
};

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
  const resource = scopedResource(result.resource, handler.kind.extensionId, input.projectId);
  if (resource.type !== handler.kind.id)
    throw new Error("The path handler returned a resource outside its owner or project.");
  if (
    !result.target ||
    !isNavigationTarget(result.target) ||
    !["page", "panel", "compound"].includes(result.target.kind)
  )
    throw new Error("The path handler did not return a resource destination.");
  const targets = [result.target];
  while (targets.length) {
    const target = targets.pop()!;
    if (target.kind === "compound") {
      targets.push(...target.targets);
    } else if (target.kind === "page" || target.kind === "panel") {
      if (target.resource) scopedResource(target.resource, handler.kind.extensionId, input.projectId);
      if (target.kind === "page" && target.parent) targets.push(target.parent);
    }
  }
  return {
    resource: {
      ...resource,
      icon: resource.icon ?? handler.kind.icon,
      extensionId: handler.kind.extensionId,
      projectId: input.projectId,
    },
    target: withSourcePosition(
      qualifyNavigationTarget(result.target, handler.kind.extensionId, input.projectId),
      input.position,
    ),
  };
};
