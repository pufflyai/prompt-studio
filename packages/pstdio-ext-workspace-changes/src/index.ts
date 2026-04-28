import { defineExtension } from "@pstdio/sdk/extensions";
import { WorkspaceChangesTab } from "./components/workspace-changes-tab";
import {
  WORKSPACE_CHANGES_EXTENSION_ID,
  WORKSPACE_CHANGES_PACKAGE_NAME,
  WORKSPACE_SHELL_TABS_SLOT,
  type WorkspaceTabViewContribution,
} from "./contract";

export default defineExtension({
  id: WORKSPACE_CHANGES_EXTENSION_ID,
  name: "Workspace Changes",
  version: "0.1.0",
  views: {
    changes: {
      type: "workspace.tab",
      label: "Changes",
      target: "workspace",
      slot: WORKSPACE_SHELL_TABS_SLOT,
      order: 10,
      component: WorkspaceChangesTab,
    } satisfies WorkspaceTabViewContribution,
  },
});

export type { WorkspaceFileDiff } from "pstdio-api-contracts";
export { buildFilteredDiffs, WorkspaceChangesPanel } from "./components/workspace-changes-panel";
export { WorkspaceChangesTab } from "./components/workspace-changes-tab";
export {
  type FileIconInfo,
  FileListPanel,
  ResizableLeftPanel,
  resolveSelectedPath,
} from "./components/workspace-file-list-panel";
export type { WorkspaceTabComponentProps, WorkspaceTabViewContribution } from "./contract";
export { type ChangedFilesViewMode, collectChangedFilePaths } from "./utils/build-changed-files-tree";
export { WORKSPACE_CHANGES_EXTENSION_ID, WORKSPACE_CHANGES_PACKAGE_NAME, WORKSPACE_SHELL_TABS_SLOT };
