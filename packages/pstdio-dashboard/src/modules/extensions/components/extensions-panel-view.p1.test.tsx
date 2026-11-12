import { expect, test } from "bun:test";
import type {
  MarketplaceExtension,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
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

test("installed and available extensions are listed alphabetically by display name", () => {
  const installedExtension = (id: string, displayName: string): ProjectExtensionInstance => ({
    id,
    projectId: "project-1",
    extensionId: `example.${id}`,
    installedExtensionId: `installed-${id}`,
    installName: id,
    name: id,
    displayName,
    sourcePath: `/extensions/${id}`,
    scope: "global",
    status: "loaded",
    enabled: true,
    config: {},
    canUpgrade: false,
    updateAvailable: false,
  });
  const availableExtension = (installName: string, displayName: string): MarketplaceExtension => ({
    installName,
    displayName,
    description: `${displayName} description`,
    installed: false,
    origin: { kind: "git", url: "https://example.com/extensions", path: installName, ref: "main" },
  });

  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ExtensionsPanelView
        extensions={[
          installedExtension("zebra", "Zebra tools"),
          installedExtension("alpha", "Alpha tools"),
          installedExtension("banana", "banana tools"),
        ]}
        marketplace={[
          availableExtension("marketplace-zebra", "Zebra marketplace"),
          availableExtension("marketplace-alpha", "Alpha marketplace"),
          availableExtension("marketplace-banana", "banana marketplace"),
        ]}
        diagnostics={[]}
        automations={[]}
      />
    </ChakraProvider>,
  );

  const orderedNames = [
    "Alpha tools",
    "banana tools",
    "Zebra tools",
    "Alpha marketplace",
    "banana marketplace",
    "Zebra marketplace",
  ].map((name) => html.indexOf(name));

  expect(orderedNames.every((index) => index >= 0)).toBe(true);
  expect([...orderedNames].sort((a, b) => a - b)).toEqual(orderedNames);
});
