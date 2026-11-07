import { expect, test } from "bun:test";
import type { ProjectExtensionInstance, WorkbenchExtensionAutomationRecord } from "@pstdio/sdk/api";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { ExtensionsPanelView } from "./extensions-panel-view";

test("automation controls belong to their installed extension instance", () => {
  const active: ProjectExtensionInstance = {
    id: "active-instance",
    projectId: "project-1",
    extensionId: "example.tool",
    installedExtensionId: "installed-tool",
    installName: "tool",
    name: "tool",
    displayName: "Example tool",
    sourcePath: "/extensions/tool",
    scope: "global",
    status: "loaded",
    enabled: true,
    config: {},
    canUpgrade: false,
    updateAvailable: false,
  };
  const automation: WorkbenchExtensionAutomationRecord = {
    id: "example.tool.schedule.daily",
    localId: "daily",
    extensionId: active.extensionId,
    extensionInstanceId: active.id,
    title: "Daily task",
    cron: "0 6 * * *",
    commandId: "example.tool.command.run",
    enabled: true,
  };
  const hasAutomationControls = (extension: ProjectExtensionInstance) =>
    renderToStaticMarkup(
      <ChakraProvider value={psTheme}>
        <ExtensionsPanelView extensions={[extension]} marketplace={[]} diagnostics={[]} automations={[automation]} />
      </ChakraProvider>,
    ).includes('data-testid="extension-automations-trigger"');

  expect(hasAutomationControls(active)).toBe(true);
  expect(hasAutomationControls({ ...active, id: "other-instance", scope: "repo", enabled: false })).toBe(false);
});
