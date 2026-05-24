import { describe, expect, test } from "bun:test";
import type { DashboardExtensionMetadata } from "@pstdio/sdk/api";
import { workbenchCommandPaletteMenuPath, workbenchTopHeaderTrailingMenuPath } from "pstdio-workbench/core";
import {
  buildDashboardExtensionMenuRegistrations,
  buildDashboardExtensionNavigationSections,
  buildDashboardExtensionRouteEntries,
} from "./workbench-extension-contributions";

const metadata = {
  extensions: [{ id: "pstdio.extension-lab", name: "extension-lab", displayName: "Extension Lab", sourcePath: "" }],
  commands: [
    { id: "extension-lab.say-hello", extensionId: "pstdio.extension-lab", title: "Say hello" },
    { id: "extension-lab.counter.bump", extensionId: "pstdio.extension-lab", title: "Bump lab counter" },
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
        resourceType: ["extension-route"],
        metadata: { extensionId: "pstdio.extension-lab", routePath: "lab" },
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
        resourceType: ["extension-route"],
        metadata: { extensionId: "pstdio.extension-lab", routePath: "lab" },
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
  ],
  navigation: [
    {
      id: "extension-lab.labPage",
      extensionId: "pstdio.extension-lab",
      slotId: "project.sidebarNav",
      group: "Lab",
      label: "Lab",
      route: "lab",
      icon: "flask-conical",
    },
    {
      id: "extension-lab.outsideProject",
      extensionId: "pstdio.extension-lab",
      slotId: "workspace.tabs",
      label: "Workspace lab",
      route: "workspace-lab",
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
  settingsPanels: [],
  views: [],
} satisfies DashboardExtensionMetadata;

const labRouteWhenExpression = [
  'dashboard.activeResource.kind == "extension-route"',
  'dashboard.activeResource.metadata.extensionId == "pstdio.extension-lab"',
  'dashboard.activeResource.metadata.routePath == "lab"',
].join(" && ");

describe("dashboard workbench extension navigation contributions", () => {
  test("maps project sidebar navigation records into extension-defined groups", () => {
    const sections = buildDashboardExtensionNavigationSections({ metadata, projectId: "project-1" });

    expect(sections).toEqual([
      {
        id: "extension-navigation-group:Lab",
        label: "Lab",
        collapsible: false,
        nodes: [
          expect.objectContaining({
            id: "dashboard-workbench://project/project-1/extensions/lab",
            label: "Lab",
            icon: "flask-conical",
            resource: expect.objectContaining({
              kind: "extension-route",
              uri: "dashboard-workbench://project/project-1/extensions/lab",
              id: "lab",
              label: "Lab",
              metadata: expect.objectContaining({
                extensionId: "pstdio.extension-lab",
                routePath: "lab",
                route: metadata.routes[0],
              }),
            }),
          }),
        ],
      },
    ]);
  });

  test("does not invent a sidebar group when navigation metadata has none", () => {
    const ungroupedMetadata = {
      ...metadata,
      navigation: metadata.navigation.map((navigation) => {
        if (navigation.id !== "extension-lab.labPage") return navigation;
        const { group, ...ungroupedNavigation } = navigation;
        return ungroupedNavigation;
      }),
    } satisfies DashboardExtensionMetadata;

    const sections = buildDashboardExtensionNavigationSections({ metadata: ungroupedMetadata, projectId: "project-1" });

    expect(sections).toEqual([]);
  });

  test("groups extension route entries from navigation metadata", () => {
    const entries = buildDashboardExtensionRouteEntries({ metadata, projectId: "project-1" });

    expect(entries).toEqual([
      expect.objectContaining({
        group: "Lab",
        resource: expect.objectContaining({ uri: "dashboard-workbench://project/project-1/extensions/lab" }),
      }),
    ]);
  });

  test("maps extension route header actions to the top header with route context", () => {
    const registrations = buildDashboardExtensionMenuRegistrations(metadata);
    const headerRegistrations = registrations.filter((registration) =>
      registration.contribution.id.endsWith(".header"),
    );
    const paletteRegistration = registrations.find(
      (registration) => registration.contribution.id === "extension-lab.say-hello.palette",
    );

    expect(headerRegistrations).toEqual([
      expect.objectContaining({
        menuPath: workbenchTopHeaderTrailingMenuPath,
        menuItem: expect.objectContaining({
          commandId: "dashboard.extension.menu.extension-lab.say-hello.header",
          group: "primary",
          when: labRouteWhenExpression,
        }),
      }),
      expect.objectContaining({
        menuPath: workbenchTopHeaderTrailingMenuPath,
        menuItem: expect.objectContaining({
          commandId: "dashboard.extension.menu.extension-lab.counter.bump.header",
          group: "overflow",
          overflowLabel: "Extension actions",
          when: labRouteWhenExpression,
        }),
      }),
    ]);
    expect(paletteRegistration).toEqual(expect.objectContaining({ menuPath: workbenchCommandPaletteMenuPath }));
  });
});
