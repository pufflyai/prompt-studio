import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { registerExtensionSettingsPanels } from "./extension-settings-panels";
import { metadata } from "./module-test-fixtures";

describe("registerExtensionSettingsPanels", () => {
  test("registers settingsSections views in their declared navigation group", () => {
    const workbench = createWorkbenchCore();
    const view = {
      id: "extension-lab.rulesView",
      extensionId: "pstdio.extension-lab",
      slotId: "unknown",
      title: "Rules",
      webview: {
        entry: { kind: "package-asset" as const, path: "./rules.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/v1/extensions/installed/extension-lab/webviews/rules/module.js",
      },
    };

    registerExtensionSettingsPanels(workbench, {
      projectId: "project-1",
      metadata: {
        ...metadata,
        views: [view],
        settingsSections: [
          {
            id: "extension-lab.rules",
            extensionId: "pstdio.extension-lab",
            group: "resources",
            label: "Rules",
            icon: "scale",
            view: view.id,
          },
        ],
      },
    });

    expect(workbench.settings.getPanel("extension-lab.rules")).toMatchObject({
      kind: "custom",
      title: "Rules",
      section: "resources",
      icon: "scale",
    });
  });
});
