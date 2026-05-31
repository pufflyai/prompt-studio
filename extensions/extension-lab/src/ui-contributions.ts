import { type ExtensionDefinition, packageAsset } from "@pstdio/sdk/extensions";

export const labModes = {
  lab: {
    id: "pstdio.extension-lab.lab",
    label: "Lab",
    icon: "flask-conical",
    layout: {
      reset: true,
      open: [
        { target: "workbench.left", view: "labSidebar", pinned: true },
        { target: "workbench.main", view: "labOverview" },
      ],
    },
  },
  labFocus: {
    id: "pstdio.extension-lab.focus",
    label: "Lab focus",
    icon: "panel-top",
    layout: {
      reset: ["workbench.main"],
      open: [{ target: "workbench.main", view: "labOverview" }],
    },
  },
} satisfies NonNullable<ExtensionDefinition["modes"]>;

export const labViews = {
  labSidebar: {
    title: "Lab",
    webview: { entry: packageAsset("./lab-sidebar.tsx", import.meta.url) },
  },
  labOverview: {
    title: "Lab overview",
    webview: {
      entry: packageAsset("./lab-overview.tsx", import.meta.url),
      capabilities: ["commands.execute", "notification.show", "preferences.get", "preferences.set"],
    },
  },
} satisfies NonNullable<ExtensionDefinition["views"]>;

export const labRoutes = {
  labPage: {
    path: "lab",
    label: "Lab",
    webview: {
      entry: packageAsset("./main.tsx", import.meta.url),
      capabilities: ["commands.execute", "notification.show", "preferences.get", "preferences.set"],
    },
  },
  faultyPage: {
    path: "lab-faulty",
    label: "Lab (faulty)",
    webview: {
      entry: packageAsset("./faulty-main.tsx", import.meta.url),
    },
  },
} satisfies NonNullable<ExtensionDefinition["routes"]>;

export const labTreeItems = {
  openLabMode: {
    target: "workbench.left.tree",
    group: "Lab",
    label: "Lab mode",
    icon: "flask-conical",
    action: {
      kind: "command",
      command: "workbench.action.switchMode",
      params: { modeId: "pstdio.extension-lab.lab" },
    },
  },
  labPage: {
    target: "workbench.left.tree",
    group: "Lab",
    label: "Lab",
    icon: "flask-conical",
    action: { kind: "route", route: "lab" },
  },
  faultyPage: {
    target: "workbench.left.tree",
    group: "Lab",
    label: "Lab (faulty)",
    icon: "flask-conical-off",
    action: { kind: "route", route: "lab-faulty" },
  },
} satisfies NonNullable<ExtensionDefinition["treeItems"]>;
