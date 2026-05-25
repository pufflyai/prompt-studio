import { describe, expect, mock, test } from "bun:test";
import type {
  CommandExecuteResponse,
  DashboardExtensionMetadata,
  ListExtensionAppearanceResponse,
} from "@pstdio/sdk/api";
import {
  createWorkbenchCore,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "pstdio-workbench/core";
import { listWorkbenchMenuItems } from "pstdio-workbench/react";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { createExtensionContributionsModule } from "./module";

const metadata = {
  extensions: [{ id: "pstdio.extension-lab", name: "extension-lab", displayName: "Extension Lab", sourcePath: "" }],
  commands: [
    { id: "extension-lab.say-hello", extensionId: "pstdio.extension-lab", title: "Say hello" },
    { id: "extension-lab.counter.bump", extensionId: "pstdio.extension-lab", title: "Bump lab counter" },
  ],
  diagnostics: [],
  menuContributions: [
    {
      id: "extension-lab.say-hello.menu.0",
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
      id: "extension-lab.counter.bump.menu.0",
      extensionId: "pstdio.extension-lab",
      commandId: "extension-lab.counter.bump",
      slotId: "project.headerOverflow",
      label: "Bump lab counter",
      when: {
        resourceType: ["extension-route"],
        metadata: { extensionId: "pstdio.extension-lab", routePath: "lab" },
      },
    },
    {
      id: "extension-lab.say-hello.menu.1",
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
      id: "extension-lab.faultyPage",
      extensionId: "pstdio.extension-lab",
      slotId: "project.sidebarNav",
      group: "Lab",
      label: "Lab (faulty)",
      route: "lab-faulty",
      icon: "flask-conical-off",
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
    {
      id: "extension-lab.faultyPage",
      extensionId: "pstdio.extension-lab",
      path: "lab-faulty",
      label: "Lab (faulty)",
      webview: {
        entry: { kind: "package-asset", path: "./src/faulty-main.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/v1/extensions/installed/extension-lab/webviews/extension-lab.faultyPage/module.js",
      },
    },
  ],
  modes: [],
  settingsPanels: [],
  views: [],
} satisfies DashboardExtensionMetadata;

const metadataWithSessionsMode = {
  ...metadata,
  modes: [
    {
      id: "pstdio-core-sessions.sessions",
      extensionId: "pstdio.pstdio-core-sessions",
      modeId: "sessions",
      label: "Sessions",
      icon: "MessageCircle",
    },
  ],
} as DashboardExtensionMetadata;

const response = {
  commandId: "extension-lab.say-hello",
  extensionId: "pstdio.extension-lab",
  outcome: { ok: true, status: "success", value: { message: "hello" } },
} satisfies CommandExecuteResponse;

const appearance = {
  themes: [
    {
      id: "pstdio.extension-lab.monokai",
      extensionId: "pstdio.extension-lab",
      title: "Extension Lab Monokai",
      format: "vscode-color-theme",
      mode: "dark",
      source: { kind: "package-asset", path: "./themes/monokai.json", baseUrl: "file:///extension/extension.ts" },
      tokens: {
        "colors.bg": "#272822",
        "colors.fg": "#f8f8f2",
      },
      monacoTheme: {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: { "editor.background": "#272822" },
      },
    },
  ],
  fileIconThemes: [],
  diagnostics: [],
} satisfies ListExtensionAppearanceResponse;

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const registerProjectMode = (workbench: ReturnType<typeof createWorkbenchCore>) => {
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
};

describe("dashboard workbench extension contribution module", () => {
  test("registers project menu contributions in dashboard-wb workbench menus", async () => {
    const loadMetadata = mock(async () => metadata);
    const executeCommand = mock(async () => response);
    const workbench = createWorkbenchCore();

    registerProjectMode(workbench);
    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
    workbench.registerModule(createExtensionContributionsModule({ loadMetadata, executeCommand }));

    await flushMicrotasks();

    expect(loadMetadata).toHaveBeenCalledWith("project-1");
    expect(workbench.layout.listMenuItems(workbenchCommandPaletteMenuPath)).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Say hello", group: "Lab" })]),
    );

    const [paletteItem] = workbench.layout
      .listMenuItems(workbenchCommandPaletteMenuPath)
      .filter((item) => item.label === "Say hello");
    expect(paletteItem).toBeDefined();

    await workbench.commands.executeCommand(paletteItem!.commandId);

    expect(executeCommand).toHaveBeenCalledWith(
      "project-1",
      "extension-lab.say-hello",
      expect.objectContaining({
        projectId: "project-1",
        source: "dashboard",
        slot: { id: "project.commandPanel", kind: "menu", context: { projectId: "project-1" } },
      }),
    );
  });

  test("shows route-scoped header actions only while the matching extension route is active", async () => {
    const loadMetadata = mock(async () => metadata);
    const executeCommand = mock(async () => response);
    const workbench = createWorkbenchCore();

    registerProjectMode(workbench);
    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
    workbench.registerModule(createExtensionContributionsModule({ loadMetadata, executeCommand }));

    await flushMicrotasks();

    expect(listWorkbenchMenuItems(workbench, workbenchTopHeaderTrailingMenuPath)).toEqual([]);

    const labResource = workbench.resources.listResources("").find((entry) => entry.resource.id === "lab")?.resource;
    expect(labResource).toBeDefined();

    await workbench.resources.openResource(labResource!);

    const labHeaderActions = listWorkbenchMenuItems(workbench, workbenchTopHeaderTrailingMenuPath);
    expect(labHeaderActions.map((item) => item.label)).toEqual(["Lab: Say hello", "Bump lab counter"]);

    await workbench.commands.executeCommand(labHeaderActions[0]!.commandId);

    expect(executeCommand).toHaveBeenCalledWith(
      "project-1",
      "extension-lab.say-hello",
      expect.objectContaining({
        projectId: "project-1",
        resource: expect.objectContaining({
          type: "extension-route",
          id: "lab",
          label: "Lab",
          extensionId: "pstdio.extension-lab",
          metadata: expect.objectContaining({ routePath: "lab" }),
        }),
        slot: {
          id: "project.headerPrimary",
          kind: "menu",
          context: {
            projectId: "project-1",
            resourceType: "extension-route",
            resourceId: "lab",
          },
        },
      }),
    );

    const faultyResource = workbench.resources
      .listResources("")
      .find((entry) => entry.resource.id === "lab-faulty")?.resource;
    expect(faultyResource).toBeDefined();

    await workbench.resources.openResource(faultyResource!);

    expect(listWorkbenchMenuItems(workbench, workbenchTopHeaderTrailingMenuPath)).toEqual([]);
  });

  test("surfaces extension command notices through workbench notifications", async () => {
    const loadMetadata = mock(async () => metadata);
    const noticeResponse = {
      ...response,
      outcome: {
        ok: true,
        status: "success",
        value: { message: "hello" },
        notices: [{ type: "info", title: "Lab", message: "Hello from the lab" }],
      },
    } satisfies CommandExecuteResponse;
    const executeCommand = mock(async () => noticeResponse);
    const workbench = createWorkbenchCore();

    registerProjectMode(workbench);
    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
    workbench.registerModule(createExtensionContributionsModule({ loadMetadata, executeCommand }));

    await flushMicrotasks();

    const [paletteItem] = workbench.layout
      .listMenuItems(workbenchCommandPaletteMenuPath)
      .filter((item) => item.label === "Say hello");
    expect(paletteItem).toBeDefined();

    await workbench.commands.executeCommand(paletteItem!.commandId);

    expect(workbench.notifications.listNotifications()).toEqual([
      expect.objectContaining({
        level: "info",
        title: "Lab",
        message: "Hello from the lab",
        metadata: expect.objectContaining({
          commandId: "extension-lab.say-hello",
          extensionId: "pstdio.extension-lab",
        }),
      }),
    ]);
  });

  test("registers extension appearance themes for the selected project", async () => {
    const loadMetadata = mock(async () => metadata);
    const loadAppearance = mock(async (projectId: string) => ({
      ...appearance,
      themes: appearance.themes.map((theme) => ({ ...theme, id: `${projectId}.${theme.id}` })),
    }));
    const workbench = createWorkbenchCore();

    registerProjectMode(workbench);
    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
    workbench.registerModule(createExtensionContributionsModule({ loadMetadata, loadAppearance }));

    await flushMicrotasks();

    expect(loadAppearance).toHaveBeenCalledWith("project-1");
    expect(workbench.themes.listThemes()).toEqual([
      expect.objectContaining({
        id: "project-1.pstdio.extension-lab.monokai",
        title: "Extension Lab Monokai",
        mode: "dark",
        tokens: appearance.themes[0]!.tokens,
        monacoTheme: appearance.themes[0]!.monacoTheme,
      }),
    ]);

    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-2");

    await flushMicrotasks();

    expect(loadAppearance).toHaveBeenCalledWith("project-2");
    expect(workbench.themes.listThemes().map((theme) => theme.id)).toEqual(["project-2.pstdio.extension-lab.monokai"]);
  });

  test("activates the native sessions mode from extension metadata", async () => {
    const loadMetadata = mock(async () => metadataWithSessionsMode);
    const workbench = createWorkbenchCore();

    registerProjectMode(workbench);
    workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
    workbench.registerModule(createExtensionContributionsModule({ loadMetadata }));

    await flushMicrotasks();

    expect(workbench.resources.getKind("session")).toMatchObject({
      label: "Session",
      icon: "MessageCircle",
    });
    expect(workbench.modes.getMode("sessions")).toMatchObject({
      label: "Sessions",
    });
  });
});
