import { defineNavigationTree, sessionBrowser } from "@pstdio/sdk/extensions";
import { workspacePages } from "./refs";

// Workspaces chooses which of its pages include scoped conversations. Sessions owns the shared renderer.
export const workspaceSessionTrees = [workspacePages.workspace, workspacePages.overview, workspacePages.history].map(
  (owner) => defineNavigationTree({ id: `${owner.id}-sessions`, owner, view: sessionBrowser.views.list }),
);
