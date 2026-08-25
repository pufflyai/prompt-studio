import type { WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";

// Shared "extension lab" metadata used by the contribution-mapping tests.
export const extensionLabMetadata = {
  extensions: [{ id: "pstdio.extension-lab", name: "extension-lab", displayName: "Extension Lab", sourcePath: "" }],
  commands: [
    { id: "extension-lab.say-hello", extensionId: "pstdio.extension-lab", title: "Say hello" },
    { id: "extension-lab.counter.bump", extensionId: "pstdio.extension-lab", title: "Bump lab counter" },
    { id: "extension-lab.run-review", extensionId: "pstdio.extension-lab", title: "Run review" },
  ],
  diagnostics: [],
  menuContributions: [
    {
      id: "extension-lab.say-hello.header",
      extensionId: "pstdio.extension-lab",
      commandId: "extension-lab.say-hello",
      slotId: "project.headerPrimary",
      label: "Lab: Say hello",
      icon: "flask-conical",
      when: {
        viewId: "extension-lab.labPage",
      },
    },
    {
      id: "extension-lab.counter.bump.header",
      extensionId: "pstdio.extension-lab",
      commandId: "extension-lab.counter.bump",
      slotId: "project.headerOverflow",
      label: "Bump lab counter",
      icon: "plus",
      when: {
        viewId: "extension-lab.labPage",
      },
    },
    {
      id: "extension-lab.say-hello.palette",
      extensionId: "pstdio.extension-lab",
      commandId: "extension-lab.say-hello",
      slotId: "project.commandPanel",
      label: "Say hello",
      group: "Lab",
    },
    {
      id: "extension-lab.run-review.header",
      extensionId: "pstdio.extension-lab",
      commandId: "extension-lab.run-review",
      slotId: "workspace.headerPrimary",
      label: "Run review",
    },
  ],
  treeItems: [
    {
      id: "extension-lab.labPage",
      extensionId: "pstdio.extension-lab",
      target: "workbench.left.tree",
      group: "Lab",
      label: "Lab",
      action: { kind: "view", viewId: "extension-lab.labPage" },
      icon: "flask-conical",
      when: { mode: "project" },
    },
  ],
  routes: [
    {
      id: "extension-lab.labPage",
      extensionId: "pstdio.extension-lab",
      path: "lab",
      label: "Lab",
      webview: {
        entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/v1/extensions/installed/extension-lab/webviews/extension-lab.labPage/module.js",
      },
    },
  ],
  modes: [],
  settingsPanels: [],
  panels: [],
} satisfies DashboardExtensionMetadata;
