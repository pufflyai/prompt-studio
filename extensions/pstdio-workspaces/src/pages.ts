import { definePage, l10n, workbenchModes, workbenchResourceKinds } from "@pstdio/sdk/extensions";
import { fileView } from "./files";
import { workspaceFileDocument } from "./refs";
import { capacityView } from "./settings";
import { actionView, changesView, historyView, summaryView, workspacesView } from "./views";

const mode = workbenchModes.project;
const resource = { kinds: [workbenchResourceKinds.workspace] };
export const workspaces = definePage({
  id: "workspaces",
  title: "Workspaces",
  icon: "folder-git-2",
  path: "workspaces",
  mode,
  main: { kind: "view", view: workspacesView.ref, cardinality: "one", presentation: "tabs" },
  slots: [],
});
export const files = definePage({
  id: "files",
  title: "Files",
  icon: "files",
  path: "files",
  mode,
  parent: workspaces.ref,
  resource,
  document: workspaceFileDocument,
  main: { kind: "view", view: fileView.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
export const workspace = definePage({
  id: "workspace",
  title: "Workspace",
  icon: "folder-git-2",
  path: "workspace",
  mode,
  parent: workspaces.ref,
  resource,
  document: workspaceFileDocument,
  params: { comparison: { type: "string", default: "provider", values: ["provider", "current", "fork_point"] } },
  main: { kind: "panels", landing: "files", empty: summaryView.ref },
  slots: [
    {
      id: "files",
      region: "main",
      tab: { query: () => ({ label: "Files" }) },
      order: 1,
      item: { kind: "view", view: fileView.ref, presence: "open" },
    },
    {
      id: "changes",
      region: "main",
      tab: { query: () => ({ label: "Changes" }) },
      order: 2,
      item: { kind: "view", view: changesView.ref, presence: "open" },
    },
  ],
});
export const history = definePage({
  id: "history",
  title: "Session history",
  icon: "history",
  path: "history",
  mode,
  parent: workspaces.ref,
  resource,
  main: { kind: "view", view: historyView.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
export const action = definePage({
  id: "action",
  title: "Workspace action",
  path: "action",
  mode,
  parent: workspaces.ref,
  params: {
    operation: { type: "string" },
    "workspace-id": { type: "string" },
    path: { type: "string" },
    selected: { type: "string" },
    anchors: { type: "string" },
    shorthand: { type: "string" },
  },
  main: { kind: "view", view: actionView.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
export const devicePage = definePage({
  id: "device",
  title: l10n("page.device", "Device details"),
  icon: "monitor",
  path: "device",
  mode,
  parent: workspaces.ref,
  params: { "device-id": { type: "string" } },
  main: { kind: "view", view: capacityView.ref, cardinality: "one", presentation: "page" },
  slots: [],
});

export const overview = definePage({
  id: "overview",
  title: "Workspace",
  icon: "folder-git-2",
  path: "overview",
  mode,
  parent: workspaces.ref,
  resource,
  main: { kind: "view", view: summaryView.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
