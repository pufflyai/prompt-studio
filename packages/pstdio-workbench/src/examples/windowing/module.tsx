import type { WorkbenchCore } from "../../core";
import type { WindowingFixtureOptions } from "./fixture-options";
import type { WindowingLifecycleProbe } from "./lifecycle-probe";
import { availabilityPages } from "./page-modes";
import { registerWindowingPagePanels } from "./page-panels";
import { type WindowingResources, windowingExtensionId, windowingPages } from "./resources";
import { WindowingSessionView } from "./session-view";
import { WindowingDraftView, WindowingResourceList, WindowingTerminalView, WindowingWebview } from "./views";

const registerWindowingMode = (workbench: WorkbenchCore, options: WindowingFixtureOptions) => {
  if (options.registerMode) options.registerMode(workbench);
  else
    workbench.modes.registerMode({
      id: "windowing",
      label: options.pageModes ? "Project" : "Windowing",
      ...(options.pageModes ? { basePage: availabilityPages.overview } : {}),
      regionSettings: options.regionSettings,
      activate() {},
    });
};

export const registerWindowingModule = (
  workbench: WorkbenchCore,
  resources: WindowingResources,
  probe: WindowingLifecycleProbe,
  options: WindowingFixtureOptions = {},
) => {
  registerWindowingMode(workbench, options);
  for (const [id, label, items, page] of [
    ["workspaces", "Workspaces", resources.workspaces, windowingPages.workspace],
    ["notes-list", "Notes", resources.notes, windowingPages.notes],
  ] as const) {
    workbench.views.registerView({
      id: `windowing.${id}`,
      title: label,
      body: {
        kind: "react",
        render: () => (
          <WindowingResourceList
            label={label}
            resources={items}
            onOpen={(resource) => {
              workbench.pageLocations.navigate({ kind: "page", page, resource, open: "pin" });
            }}
          />
        ),
      },
    });
  }
  workbench.views.registerView({
    id: "windowing.sessions-list",
    title: "Sessions",
    body: {
      kind: "react",
      render: () => (
        <WindowingResourceList
          label="Sessions"
          resources={resources.sessions}
          onOpen={(resource) => {
            void workbench.navigation.openTarget({
              kind: "panel",
              panel: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
              resource,
              open: "pin",
            });
          }}
        />
      ),
    },
  });
  for (const [label, id] of [
    ["Files", "files"],
    ["Changes", "changes"],
    ["Notes", "note"],
    ["Session", "session"],
  ]) {
    workbench.views.registerView({
      id: `windowing.${id}`,
      title: label,
      body: {
        kind: "react",
        render: ({ instance }) =>
          id === "session" ? (
            <WindowingSessionView resource={instance.resource} resources={resources} probe={probe} />
          ) : (
            <WindowingDraftView label={label} resource={instance.resource} probe={probe} />
          ),
      },
    });
  }
  workbench.views.registerView({
    id: "windowing.terminal",
    title: "Terminal",
    body: {
      kind: "react",
      render: ({ instance }) => {
        const terminal = resources.terminals.find((item) => item.metadata.workspaceId === instance.resource?.id)!;
        return <WindowingTerminalView resource={terminal} probe={probe} />;
      },
    },
  });
  workbench.views.registerView({
    id: "windowing.webview",
    title: "Webview",
    body: { kind: "react", render: () => <WindowingWebview /> },
  });
  if (options.pagePanels) registerWindowingPagePanels(workbench);
  workbench.modePlacements.registerPlacement({
    id: "windowing.sessions",
    ref: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
    modeId: "windowing",
    region: "side",
    tab: {
      getSnapshot: (instance) => ({
        context: resources.sessions.find((session) => session.id === instance.resource?.id)?.context,
      }),
      subscribe: resources.subscribeContext,
    },
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "windowing.session" }],
        view: { kind: "view", id: "windowing.session" },
        cardinality: "many",
      },
    },
  });
  workbench.pages.registerPage({
    id: "windowing.workspaces",
    ref: windowingPages.workspaces,
    title: "Workspaces",
    path: "windowing/workspaces",
    modeId: "windowing",
    main: { kind: "view", view: { kind: "view", id: "windowing.workspaces" }, cardinality: "one" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "windowing.notes-list",
    ref: windowingPages.notesCollection,
    title: "Notes",
    path: "windowing/notes",
    modeId: "windowing",
    main: { kind: "view", view: { kind: "view", id: "windowing.notes-list" }, cardinality: "one" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "windowing.workspace",
    ref: windowingPages.workspace,
    title: "Workspace",
    path: "windowing/workspaces/resource",
    parentId: "windowing.workspaces",
    modeId: "windowing",
    resource: { kinds: [{ kind: "resource-kind", id: "windowing.workspace" }] },
    main: {
      kind: "view",
      view: { kind: "view", id: `windowing.${options.mainView ?? "files"}` },
      cardinality: "one",
      ...(options.pagePanels
        ? {
            tab: {
              getSnapshot: () => ({ label: options.mainView === "webview" ? "Webview" : "Files", icon: "Files" }),
            },
          }
        : {}),
    },
    ...(options.pagePanels
      ? {
          panelMenus: {
            left: { view: { kind: "view" as const, id: "windowing.workspace-menu" }, size: { defaultPx: 180 } },
            right: { view: { kind: "view" as const, id: "windowing.inspector" }, size: { defaultPx: 200 } },
          },
          regionSettings: { bottom: { size: { defaultPx: 160 }, alwaysShowTabs: true } },
        }
      : {}),
    slots: [
      {
        id: "changes",
        ...(options.pagePanels ? { tab: { getSnapshot: () => ({ label: "Changes", icon: "GitCompare" }) } } : {}),
        region: options.pagePanels ? "main" : "secondary",
        item: {
          kind: "view",
          view: { kind: "view", id: "windowing.changes" },
          presence: options.changesPresence ?? "open",
        },
      },
      {
        id: "terminal",
        ...(options.pagePanels ? { tab: { getSnapshot: () => ({ label: "Terminal", icon: "Terminal" }) } } : {}),
        region: options.pagePanels ? "bottom" : "side",
        item: { kind: "view", view: { kind: "view", id: "windowing.terminal" }, presence: "open" },
      },
    ],
  });
  workbench.pages.registerPage({
    id: "windowing.notes",
    ref: windowingPages.notes,
    title: "Notes",
    path: "windowing/notes/resource",
    parentId: "windowing.notes-list",
    modeId: "windowing",
    resource: { kinds: [{ kind: "resource-kind", id: "windowing.note" }] },
    main: { kind: "view", view: { kind: "view", id: "windowing.note" }, cardinality: "many" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "windowing.sessions",
    ref: windowingPages.sessions,
    title: "Sessions",
    path: "windowing/sessions",
    modeId: "windowing",
    main: { kind: "view", view: { kind: "view", id: "windowing.sessions-list" }, cardinality: "one" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "windowing.webview",
    ref: windowingPages.webview,
    title: "Webview",
    path: "windowing/webview",
    modeId: "windowing",
    main: { kind: "view", view: { kind: "view", id: "windowing.webview" }, cardinality: "one" },
    slots: [],
  });
  for (const [label, items] of [
    ["Workspace", resources.workspaces],
    ["Note", resources.notes],
    ["Session", resources.sessions],
    ["Terminal", resources.terminals],
  ] as const) {
    const kind = items[0]!.type;
    workbench.resources.registerKind({ kind, label });
    workbench.resources.registerProvider({
      id: kind,
      kind,
      list: (query) =>
        items
          .filter((item) => item.label?.toLowerCase().includes(query.toLowerCase()))
          .map((resource) => ({ resource })),
    });
  }
};
