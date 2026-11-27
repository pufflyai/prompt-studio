import { expect, test } from "bun:test";
import type {
  MarketplaceExtension,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { ExtensionActionButton } from "./extension-action-button";
import type { ExtensionActionState } from "./extension-action-feedback";
import type { ExtensionUpgradeBatch } from "./extension-actions";
import { ExtensionsPanelView } from "./extensions-panel-view";

test("installed extensions expose author and scope independently", () => {
  const extension: ProjectExtensionInstance = {
    id: "local-copy",
    projectId: "project",
    extensionId: "example.tool",
    installedExtensionId: "source",
    installName: "tool",
    name: "tool",
    displayName: "Local public tool",
    sourcePath: "/source",
    scope: "repo",
    status: "loaded",
    enabled: true,
    config: {},
    canUpgrade: false,
    updateAvailable: false,
    ownership: "mine",
    visibility: "public",
    author: { kind: "self" },
  };
  const markup = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ExtensionsPanelView
        extensions={[extension]}
        marketplace={[]}
        diagnostics={[]}
        automations={[]}
        filters={{ search: "" }}
        onFiltersChange={() => {}}
      />
    </ChakraProvider>,
  );
  expect(markup.includes('data-extension-author="me"')).toBe(true);
  expect(markup.includes('data-extension-scope="repo"')).toBe(true);
  expect(markup.indexOf('data-testid="extensions-group-enabled"')).toBeLessThan(
    markup.indexOf('data-testid="extension-entry"'),
  );
});

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

const groupedExtension = (
  id: string,
  enabled: boolean,
  scope: "repo" | "global",
  firstParty: boolean,
): ProjectExtensionInstance => ({
  id,
  enabled,
  scope,
  author: firstParty ? { kind: "publisher", publisher: "pstdio" } : { kind: "self" },
  projectId: "project",
  extensionId: `example.${id}`,
  installedExtensionId: id,
  installName: id,
  name: id,
  displayName: id,
  sourcePath: "/source",
  status: enabled ? "loaded" : "disabled",
  config: {},
  canUpgrade: false,
  updateAvailable: false,
});

test.each([
  { name: "one update", count: 1, paused: 0, visible: false },
  { name: "all updates paused", count: 2, paused: 2, visible: false },
  { name: "one runnable update", count: 2, paused: 1, visible: false },
  { name: "multiple runnable updates", count: 3, paused: 1, visible: true },
])("Upgrade all visibility with $name", ({ count, paused, visible }) => {
  const extensions = Array.from({ length: count }, (_, index) => ({
    ...groupedExtension(`tool-${index}`, true, "global", true),
    canUpgrade: true,
    updateAvailable: true,
  }));
  const actionStates: Record<string, ExtensionActionState> = Object.fromEntries(
    extensions.slice(0, paused).map(({ id }) => [id, { status: "error", label: "Update paused", needsReview: true }]),
  );
  const batch: ExtensionUpgradeBatch | undefined = paused
    ? { ids: extensions.map(({ id }) => id), completed: count, failed: 0, reviewRequired: paused, running: false }
    : undefined;
  const markup = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ExtensionsPanelView
        extensions={extensions}
        actionStates={actionStates}
        batch={batch}
        marketplace={[]}
        diagnostics={[]}
        automations={[]}
      />
    </ChakraProvider>,
  );
  expect(markup.includes('data-testid="extensions-upgrade-all"')).toBe(visible);
});

test.each(["running", "queued"] as const)("does not count an individual %s update toward Upgrade all", (status) => {
  const extensions = ["one", "two"].map((id) => ({
    ...groupedExtension(id, true, "global", true),
    canUpgrade: true,
    updateAvailable: true,
  }));
  const markup = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ExtensionsPanelView
        extensions={extensions}
        actionStates={{ one: { status, label: "Upgrading" } }}
        marketplace={[]}
        diagnostics={[]}
        automations={[]}
      />
    </ChakraProvider>,
  );
  expect(markup).not.toContain('data-testid="extensions-upgrade-all"');
});

test("groups enabled before other installed extensions and searches across authors and scopes", () => {
  const extensions = [
    groupedExtension("z-personal-project", true, "repo", false),
    groupedExtension("a-publisher-project", false, "repo", true),
    groupedExtension("personal-global", false, "global", false),
    groupedExtension("publisher-global", true, "global", true),
  ];
  const render = (search = "") =>
    renderToStaticMarkup(
      <ChakraProvider value={psTheme}>
        <ExtensionsPanelView
          extensions={extensions}
          marketplace={[]}
          diagnostics={[]}
          automations={[]}
          filters={{ search }}
          onFiltersChange={() => {}}
        />
      </ChakraProvider>,
    );
  const ids = (html: string) => [...html.matchAll(/data-extension-id="([^"]+)"/g)].map((match) => match[1]);
  const all = render();
  expect(ids(all)).toEqual(["publisher-global", "z-personal-project", "a-publisher-project", "personal-global"]);
  expect(all.indexOf('data-testid="extensions-group-enabled"')).toBeLessThan(
    all.indexOf('data-testid="extensions-group-installed"'),
  );
  expect(ids(render("personal"))).toEqual(["z-personal-project", "personal-global"]);
  expect(ids(render("PUBLISHER"))).toEqual(["publisher-global", "a-publisher-project"]);
  expect(ids(render("absent"))).toEqual([]);
});

test.each([false, true])("shows conflict controls only with a confirmed edit (%s)", (localEditsConfirmed) => {
  const markup = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ExtensionActionButton
        action={{ status: "error", label: "Update paused", needsReview: true, localEditsConfirmed }}
        onRetry={() => {}}
      >
        Upgrade
      </ExtensionActionButton>
    </ChakraProvider>,
  );
  expect(markup.includes('data-testid="extension-upgrade-conflict"')).toBe(localEditsConfirmed);
  expect(markup.includes("Choose version")).toBe(!localEditsConfirmed);
});
