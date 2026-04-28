import type { ComponentType } from "react";

export const WORKSPACE_CHANGES_EXTENSION_ID = "pstdio.workspace-changes";
export const WORKSPACE_CHANGES_PACKAGE_NAME = "@pstdio/pstdio-ext-workspace-changes";
export const WORKSPACE_SHELL_TABS_SLOT = "pstdio.workspace-shell.tabs";

export type WorkspaceTabComponentProps = {
  projectId: string | undefined;
  ticketId: string;
  workspaceId: string | null;
};

export type WorkspaceTabViewContribution = {
  type: "workspace.tab";
  label: string;
  target: "workspace";
  slot: typeof WORKSPACE_SHELL_TABS_SLOT;
  order?: number;
  component: ComponentType<WorkspaceTabComponentProps>;
};
