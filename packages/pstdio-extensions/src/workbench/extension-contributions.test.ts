import { describe, expect, test } from "bun:test";
import type { DashboardExtensionMetadata } from "@pstdio/sdk/api";
import {
  buildWorkbenchExtensionMenuRegistrations,
  buildWorkbenchExtensionNavigationSections,
  buildWorkbenchExtensionRouteEntries,
} from "./extension-contributions";

const metadata = {
  extensions: [{ id: "pstdio.extension-lab", name: "extension-lab", displayName: "Extension Lab", sourcePath: "" }],
  commands: [{ id: "extension-lab.say-hello", extensionId: "pstdio.extension-lab", title: "Say hello" }],
  diagnostics: [],
  menuContributions: [
    {
      id: "extension-lab.say-hello.header",
      extensionId: "pstdio.extension-lab",
      commandId: "extension-lab.say-hello",
      slotId: "project.headerPrimary",
      label: "Lab: Say hello",
      icon: "flask-conical",
      when: { resourceType: ["extension-route"] },
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

const createResource = ({ route }: { route: DashboardExtensionMetadata["routes"][number] }) => ({
  kind: "extension-route",
  uri: `workbench://extension-route/${route.path}`,
  id: route.path,
  label: route.label,
});

describe("workbench extension contribution mapping", () => {
  test("maps navigation contributions into extension-defined sidebar groups", () => {
    const sections = buildWorkbenchExtensionNavigationSections({
      metadata,
      slotId: "project.sidebarNav",
      createResource,
    });

    expect(sections).toEqual([
      {
        id: "extension-navigation-group:Lab",
        label: "Lab",
        collapsible: false,
        nodes: [
          expect.objectContaining({
            id: "workbench://extension-route/lab",
            label: "Lab",
            icon: "flask-conical",
          }),
        ],
      },
    ]);
  });

  test("does not invent sidebar groups when navigation metadata has none", () => {
    const ungroupedMetadata = {
      ...metadata,
      navigation: metadata.navigation.map((navigation) => {
        const { group, ...ungroupedNavigation } = navigation;
        return ungroupedNavigation;
      }),
    } satisfies DashboardExtensionMetadata;

    const sections = buildWorkbenchExtensionNavigationSections({
      metadata: ungroupedMetadata,
      slotId: "project.sidebarNav",
      createResource,
    });

    expect(sections).toEqual([]);
  });

  test("maps menu contributions into workbench registrations with host slot config", () => {
    const registrations = buildWorkbenchExtensionMenuRegistrations({
      metadata,
      menuSlotsById: new Map([
        ["project.headerPrimary", { menuPath: ["project", "header", "primary"], group: "primary" }],
        ["project.commandPanel", { menuPath: ["workbench", "commandPalette"] }],
      ]),
      createCommandId: (contribution) => `host.extension.menu.${contribution.id}`,
      createWhenExpression: (contribution) =>
        contribution.when?.resourceType?.includes("extension-route")
          ? "activeResource.kind == extension-route"
          : undefined,
    });

    expect(registrations).toEqual([
      expect.objectContaining({
        targetCommandId: "extension-lab.say-hello",
        command: expect.objectContaining({ id: "host.extension.menu.extension-lab.say-hello.header" }),
        menuItem: expect.objectContaining({
          group: "primary",
          icon: "flask-conical",
          when: "activeResource.kind == extension-route",
        }),
      }),
      expect.objectContaining({
        targetCommandId: "extension-lab.say-hello",
        command: expect.objectContaining({ category: "Lab" }),
        menuItem: expect.objectContaining({ group: "Lab" }),
      }),
    ]);
  });

  test("groups route entries from navigation metadata", () => {
    const entries = buildWorkbenchExtensionRouteEntries({
      metadata,
      navigationSlotId: "project.sidebarNav",
      createResource,
    });

    expect(entries).toEqual([
      expect.objectContaining({
        group: "Lab",
        resource: expect.objectContaining({ uri: "workbench://extension-route/lab" }),
      }),
    ]);
  });
});
