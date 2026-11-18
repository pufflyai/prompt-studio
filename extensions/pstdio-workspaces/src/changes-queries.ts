import type { ResourceRef, WebviewClient } from "@pstdio/sdk/extensions";
import type { commands } from "./commands";
import { refreshEvents } from "./events";

export const createChangesQueries = (
  client: WebviewClient<typeof commands>,
  workspaceId: string,
  mode: "current" | "fork_point",
  resource?: ResourceRef,
) => {
  const identity = resource && {
    type: resource.type,
    extensionId: resource.extensionId,
    projectId: resource.projectId,
    id: workspaceId,
  };
  const options = { resource: identity, events: refreshEvents, dependency: { resourceId: workspaceId } };
  return {
    summary: client.commands["read-changes"].query({ workspaceId, mode }, options),
    body: (path: string) => client.commands["read-diff"].query({ workspaceId, mode, path }, options),
  };
};

/** Scope selection independently from lazy file bodies and Git history. */
export const createChangesSelection = (
  client: WebviewClient<typeof commands>,
  projectId: string | undefined,
  workspaceId: string,
  mode: string,
) => {
  const name = "workspace.changes.selection." + workspaceId + "." + mode;
  const scope = { scope: "project" as const, scopeId: projectId };
  const query = client.preferences.query(name, scope);
  return { query, save: (path: string) => client.preferences.set(name, path, scope) };
};
