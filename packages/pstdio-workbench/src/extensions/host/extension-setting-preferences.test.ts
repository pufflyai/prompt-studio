import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench } from "../../core";
import { createWorkbenchWebviewHostCapabilities } from "../bridge/webview-host-capabilities";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

test("extension settings retain their owners and warn on deprecated cross-extension access", async () => {
  const workbench = createWorkbench();
  const metadata = {
    extensions: [],
    commands: [],
    menuContributions: [],
    commandPaletteContributions: [],
    modes: [],
    pages: [],
    views: [],
    viewMenus: [],
    placements: [],
    resourceKinds: [],
    navigationItems: [],
    navigationTrees: [],
    statusBarItems: [],
    settingsPanels: [],
    diagnostics: [],
    settingsDefinitions: [
      { extensionId: "acme.a", key: "shared", type: "string", scope: "global", default: "first" },
      { extensionId: "acme.a", key: "a.setting", type: "string", scope: "global", default: "a" },
      { extensionId: "acme.b", key: "shared", type: "string", scope: "global", default: "last" },
    ],
  } satisfies WorkbenchExtensionMetadata;
  const registration = registerWorkbenchExtensionContributions({
    workbench,
    metadata,
    projectId: "project",
    executeCommand: () => undefined,
  });
  expect(workbench.preferences.getSchema("a.setting")?.ownerId).toBe("acme.a");
  expect(workbench.preferences.getSchema("shared")?.ownerId).toBe("acme.b");
  expect(workbench.preferences.getValue("shared")).toBe("last");
  const warnings: string[] = [];
  const caller = createWorkbenchWebviewHostCapabilities({
    workbench,
    extensionId: "acme.b",
    warn: (message) => warnings.push(message),
  });
  await caller["preferences.set"]({ name: "a.setting", value: "legacy" });
  expect(workbench.preferences.getValue("a.setting")).toBe("legacy");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("deprecated");
  registration.dispose();
  expect(workbench.preferences.getSchema("a.setting")).toBeUndefined();
  expect(workbench.preferences.getSchema("shared")).toBeUndefined();
});
