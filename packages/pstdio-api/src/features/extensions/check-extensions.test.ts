import { describe, expect, test } from "bun:test";
import { packageAsset, projectSlots } from "@pstdio/sdk/extensions";
import type { CheckExtensionsResult } from "pstdio-extensions";
import { buildCheckResponse } from "./check-extensions";

const emptyCheckResult = (overrides: Partial<CheckExtensionsResult["runtime"]> = {}): CheckExtensionsResult => ({
  homeRoot: "/tmp/home",
  extensionsRoot: "/tmp/home/extensions",
  extensionsRootExists: true,
  installedExtensionDirs: [],
  errorCount: 0,
  warningCount: 0,
  runtime: {
    extensions: [],
    commands: [],
    middlewares: [],
    hooks: [],
    cli: [],
    schedules: [],
    artifactMounts: [],
    views: [],
    routes: [],
    navigation: [],
    settingsPanels: [],
    templateTypes: [],
    templates: [],
    skills: [],
    harnesses: [],
    workspaceTypes: [],
    diagnostics: [],
    ...overrides,
  },
});

describe("buildCheckResponse", () => {
  test("serializes slot-aware dashboard contributions", () => {
    const result = emptyCheckResult({
      commands: [
        {
          id: "lab.say-hello",
          localId: "say-hello",
          extensionId: "pstdio.extension-lab",
          namespace: "lab",
          sourcePath: "/tmp/home/extensions/lab/extension.ts",
          title: "Say hello",
          params: {},
          commandPanel: {},
          menus: [
            {
              slot: projectSlots.headerPrimary,
              label: "Lab: Say hello",
              placement: "first",
              params: { greeting: "hi" },
            },
          ],
          run: async () => undefined,
        },
      ],
      navigation: [
        {
          id: "lab.page",
          localId: "page",
          extensionId: "pstdio.extension-lab",
          namespace: "lab",
          sourcePath: "/tmp/home/extensions/lab/extension.ts",
          contribution: {
            slot: projectSlots.sidebarNav,
            label: "Lab",
            route: "lab",
            icon: "flask-conical",
          },
        },
      ],
      views: [
        {
          id: "lab.sidebar",
          localId: "sidebar",
          extensionId: "pstdio.extension-lab",
          namespace: "lab",
          sourcePath: "/tmp/home/extensions/lab/extension.ts",
          contribution: {
            title: "Lab sidebar",
            slot: projectSlots.sidebar,
            webview: {
              entry: packageAsset("./dist/sidebar.js", import.meta.url),
            },
          },
        },
      ],
      routes: [
        {
          id: "lab.page",
          localId: "page",
          extensionId: "pstdio.extension-lab",
          namespace: "lab",
          sourcePath: "/tmp/home/extensions/lab/extension.ts",
          contribution: {
            path: "lab",
            label: "Lab",
            webview: {
              entry: packageAsset("./dist/lab-page.html", import.meta.url),
            },
          },
        },
      ],
      settingsPanels: [
        {
          id: "lab.settings",
          localId: "settings",
          extensionId: "pstdio.extension-lab",
          namespace: "lab",
          sourcePath: "/tmp/home/extensions/lab/extension.ts",
          contribution: {
            title: "Lab settings",
            slot: projectSlots.settingsPanels,
            webview: {
              entry: packageAsset("./dist/settings.js", import.meta.url),
            },
          },
        },
      ],
    });

    const response = buildCheckResponse(result);

    expect(response.menuContributions).toEqual([
      {
        id: "lab.say-hello:project.headerPrimary",
        extensionId: "pstdio.extension-lab",
        commandId: "lab.say-hello",
        slotId: "project.headerPrimary",
        label: "Lab: Say hello",
        placement: "first",
        params: { greeting: "hi" },
      },
    ]);
    expect(response.navigation[0]).toMatchObject({
      id: "lab.page",
      extensionId: "pstdio.extension-lab",
      slotId: "project.sidebarNav",
      label: "Lab",
      route: "lab",
      icon: "flask-conical",
    });
    expect(response.views[0]).toMatchObject({
      id: "lab.sidebar",
      extensionId: "pstdio.extension-lab",
      slotId: "project.sidebar",
      title: "Lab sidebar",
    });
    expect(response.routes[0]).toMatchObject({
      id: "lab.page",
      extensionId: "pstdio.extension-lab",
      path: "lab",
      label: "Lab",
    });
    expect(response.routes[0]?.webview.entry.path).toBe("./dist/lab-page.html");
    expect(response.settingsPanels[0]).toMatchObject({
      id: "lab.settings",
      extensionId: "pstdio.extension-lab",
      slotId: "project.settingsPanels",
      title: "Lab settings",
    });
  });
});
