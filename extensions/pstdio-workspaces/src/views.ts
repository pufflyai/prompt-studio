import { defineView, packageAsset } from "@pstdio/sdk/extensions";
import { refreshEvents } from "./events";
import { listSessions, queryWorkspaces, sessionRows } from "./query";
import { workspaceCommands } from "./refs";

const grouped = {
  columnGrouping: "device",
  displayProperties: ["id", "tickets", "type", "date"],
  showChildren: false,
};
export const workspacesView = defineView({
  id: "workspaces",
  title: "Workspaces",
  icon: "folder-git-2",
  body: {
    kind: "resourceList",
    refreshEvents,
    query: (ctx) => queryWorkspaces(ctx),
    defaultSettings: grouped,
    defaultViews: [
      { id: "grouped", title: "By device", settings: grouped },
      { id: "compact", title: "Compact", settings: { ...grouped, columnGrouping: "none" } },
    ],
    defaultActiveViewId: "grouped",
    createRow: {
      presentation: "command",
      command: workspaceCommands.create,
      title: "New workspace",
      submitLabel: "Continue",
      columnParam: "deviceId",
      params: {},
      labels: { submitError: "Could not open workspace creation" },
    },
  },
});
export const historyView = defineView({
  id: "history",
  title: "Session history",
  body: {
    kind: "resourceList",
    refreshEvents,
    hideToolbar: true,
    async query(ctx, { renderer }) {
      return {
        rows: sessionRows(await listSessions(ctx, renderer.resource?.id), ctx.project.id),
        attributes: [
          { id: "status", label: "Status", displayable: true, type: { kind: "string" } },
          { id: "harness", label: "Harness", displayable: true, type: { kind: "string" } },
          { id: "date", label: "Created", displayable: true, type: { kind: "date" } },
        ],
      };
    },
    defaultSettings: { displayProperties: ["status", "harness", "date"], showChildren: false },
  },
});
export const changesView = defineView({
  id: "changes",
  title: "Changes",
  icon: "file-diff",
  body: {
    kind: "webview",
    entry: packageAsset("./changes-view.tsx", import.meta.url),
    capabilities: ["commands.execute", "commands.query", "preferences.get", "preferences.set", "page.params.update"],
  },
});
export const actionView = defineView({
  id: "action",
  title: "Workspace action",
  body: {
    kind: "webview",
    entry: packageAsset("./action-view.tsx", import.meta.url),
    capabilities: ["commands.execute", "commands.query", "navigation.open", "placement.close"],
  },
});
export const summaryView = defineView({
  id: "summary",
  title: "Workspace",
  body: {
    kind: "controls",
    refreshEvents,
    async query(ctx, { renderer }) {
      const workspace = await ctx.workspaces.get(renderer.resource?.id ?? "");
      return {
        params: [
          {
            id: "workspace",
            name: "Workspace",
            type: "readOnly",
            value: workspace?.setupError || workspace?.name || workspace?.shorthand || "Workspace unavailable",
          },
          { id: "state", name: "State", type: "readOnly", value: workspace?.providerState ?? "Unavailable" },
        ],
        readOnly: true,
      };
    },
  },
});
