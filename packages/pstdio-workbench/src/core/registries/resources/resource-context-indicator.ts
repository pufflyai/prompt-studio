import type { ResourceRef } from "@pstdio/sdk/extensions";

const containingWorkspace = (owner: ResourceRef | undefined) => {
  if (owner?.type === "workspace") return { id: owner.id, projectId: owner.projectId };
  if (owner?.context?.type === "workspace" && owner.context.id === owner.id) return owner.context;
  return undefined;
};

export const resourceContextIndicator = (owner: ResourceRef | undefined, resource: ResourceRef | undefined) => {
  const workspace = containingWorkspace(owner);
  const context = resource?.context;
  if (!workspace || !context) return undefined;
  const projectId = context.type === "workspace" ? (context.projectId ?? resource?.projectId) : context.id;
  if (
    context.type === "workspace" &&
    context.id === workspace.id &&
    (projectId ?? owner?.projectId) === (workspace.projectId ?? owner?.projectId)
  )
    return undefined;
  const label = context.label ?? `${context.type === "project" ? "Project" : "Workspace"} ${context.id}`;
  return { icon: "Link", color: "fg.muted", label: `Outside this workspace · ${label}` };
};
