import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import {
  buildWorkbenchExtensionMenuRegistrations,
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
} satisfies WorkbenchExtensionMetadata;

const createResource = ({ route }: { route: WorkbenchExtensionMetadata["routes"][number] }) => ({
  kind: "extension-route",
  uri: `workbench://extension-route/${route.path}`,
  id: route.path,
  label: typeof route.label === "string" ? route.label : (route.label.default ?? route.label.$l10n),
});

describe("workbench extension contribution mapping", () => {
  test("maps menu contributions into workbench registrations with host slot config", () => {
    const registrations = buildWorkbenchExtensionMenuRegistrations({
      metadata,
      menuSlotsById: new Map([
        ["project.headerPrimary", { menuPath: ["project", "header", "primary"], group: "primary" }],
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
          sourceCommandId: "extension-lab.say-hello",
          when: "activeResource.kind == extension-route",
        }),
      }),
    ]);
  });

  test("carries the source command params onto the wrapper command", () => {
    const parameterizedMetadata = {
      ...metadata,
      commands: [
        {
          id: "extension-lab.say-hello",
          extensionId: "pstdio.extension-lab",
          title: "Say hello",
          params: { agent: { type: "harness", label: "Agent" } },
        },
      ],
    } satisfies WorkbenchExtensionMetadata;

    const registrations = buildWorkbenchExtensionMenuRegistrations({
      metadata: parameterizedMetadata,
      menuSlotsById: new Map([
        ["project.headerPrimary", { menuPath: ["project", "header", "primary"], group: "primary" }],
      ]),
      createCommandId: (contribution) => `host.extension.menu.${contribution.id}`,
    });

    expect(registrations[0]?.command.params).toEqual({ agent: { type: "harness", label: "Agent" } });
  });

  test("lists route entries without legacy navigation grouping", () => {
    const entries = buildWorkbenchExtensionRouteEntries({
      metadata,
      createResource,
    });

    expect(entries).toEqual([
      expect.objectContaining({
        resource: expect.objectContaining({ uri: "workbench://extension-route/lab" }),
      }),
    ]);
    expect(entries[0]).not.toHaveProperty("group");
  });
});
