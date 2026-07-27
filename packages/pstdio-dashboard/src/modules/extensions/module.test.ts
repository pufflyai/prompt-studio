import { describe, expect, mock, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbenchCore, resourceContextMenuPath, workbenchCommandPaletteMenuPath } from "@pstdio/workbench/core";
import { listWorkbenchMenuItems } from "@pstdio/workbench/react";
import i18n from "@/i18n";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createSessionBubbleModule } from "../sessions/bubble/module";
import { createExtensionsModule } from "./module";
import { flushMicrotasks, metadata, response } from "./module-test-fixtures";

describe("createExtensionsModule", () => {
  test("localizes extension menu and route labels from appearance translations", async () => {
    await i18n.changeLanguage("fr");
    const loadMetadata = mock(async () => ({
      ...metadata,
      commands: [
        {
          id: "extension-lab.say-hello",
          extensionId: "pstdio.extension-lab",
          title: { $l10n: "commands.sayHello.title", default: "Say hello" },
        },
      ],
      menuContributions: [
        {
          ...metadata.menuContributions[0]!,
          label: { $l10n: "commands.sayHello.menu", default: "Lab: Say hello" },
        },
      ],
      routes: [
        {
          ...metadata.routes[0]!,
          label: { $l10n: "routes.lab.label", default: "Lab" },
        },
      ],
      treeItems: [
        {
          ...metadata.treeItems[0]!,
          label: { $l10n: "routes.lab.label", default: "Lab" },
        },
      ],
    }));
    const loadAppearance = mock(async () => ({
      themes: [],
      fileIconThemes: [],
      translations: [
        {
          extensionId: "pstdio.extension-lab",
          defaultLocale: "en",
          bundles: {
            en: {
              "commands.sayHello.menu": "Lab: Say hello",
              "commands.sayHello.title": "Say hello",
              "routes.lab.label": "Lab",
            },
            fr: {
              "commands.sayHello.menu": "Lab: Dire bonjour",
              "commands.sayHello.title": "Dire bonjour",
              "routes.lab.label": "Laboratoire",
            },
          },
        },
      ],
      diagnostics: [],
    }));
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, loadAppearance }));

    try {
      await flushMicrotasks();

      const labResource = workbench.resources.listResources("").find((entry) => entry.resource.id === "lab")?.resource;
      expect(labResource?.label).toBe("Laboratoire");

      await workbench.resources.openResource(labResource!);

      const resourceActions = listWorkbenchMenuItems(workbench, resourceContextMenuPath("extension-route"), {
        resource: labResource,
      });
      expect(resourceActions.map((item) => item.label)).toEqual(["Lab: Dire bonjour"]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
      await i18n.changeLanguage("en");
    }
  });

  test("mounts extension-lab routes and route-scoped resource actions", async () => {
    const loadMetadata = mock(async () => metadata);
    const executeCommand = mock(async () => response);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, executeCommand }));

    try {
      await flushMicrotasks();

      const labResource = workbench.resources.listResources("").find((entry) => entry.resource.id === "lab")?.resource;

      expect(labResource?.kind).toBe("extension-route");
      expect(labResource?.uri).toBe("dashboard-workbench://project/project-1/extensions/lab");
      expect(labResource?.metadata?.extensionId).toBe("pstdio.extension-lab");
      expect(labResource?.metadata?.routePath).toBe("lab");

      await workbench.resources.openResource(labResource!);

      const resourceActions = listWorkbenchMenuItems(workbench, resourceContextMenuPath("extension-route"), {
        resource: labResource,
      });
      expect(resourceActions.map((item) => item.label)).toEqual(["Lab: Say hello", "Bump lab counter"]);

      await workbench.commands.executeCommand(resourceActions[0]!.commandId, undefined, { resource: labResource });

      expect(executeCommand).toHaveBeenCalledWith(
        "project-1",
        "extension-lab.say-hello",
        expect.objectContaining({
          projectId: "project-1",
          resource: expect.objectContaining({
            type: "extension-route",
            id: "lab",
            extensionId: "pstdio.extension-lab",
          }),
          slot: expect.objectContaining({
            id: "project.headerPrimary",
            kind: "menu",
          }),
        }),
      );
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("registers extension command palette contributions with icons", async () => {
    const loadMetadata = mock(async () => ({
      ...metadata,
      commandPaletteContributions: [
        {
          id: "extension-lab.say-hello.palette.0",
          extensionId: "pstdio.extension-lab",
          commandId: "extension-lab.say-hello",
          label: "Say hello",
          group: "Lab",
          icon: "flask-conical",
          params: { source: "palette" },
        },
      ],
    }));
    const executeCommand = mock(async () => response);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, executeCommand }));

    try {
      await flushMicrotasks();

      const paletteAction = workbench.layout
        .listMenuItems(workbenchCommandPaletteMenuPath)
        .find((item) => item.commandId === "dashboard.extension.palette.extension-lab.say-hello.palette.0");

      expect(paletteAction).toMatchObject({
        commandId: "dashboard.extension.palette.extension-lab.say-hello.palette.0",
        icon: "flask-conical",
        label: "Say hello",
      });
      expect(workbench.commands.getCommand(paletteAction!.commandId)?.command.icon).toBe("flask-conical");

      await workbench.commands.executeCommand(paletteAction!.commandId);

      expect(executeCommand).toHaveBeenCalledWith(
        "project-1",
        "extension-lab.say-hello",
        expect.objectContaining({
          params: { source: "palette" },
          projectId: "project-1",
          slot: expect.objectContaining({
            id: "workbench.commandPalette",
            kind: "menu",
          }),
        }),
      );
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});

describe("createExtensionsModule command results and refresh", () => {
  test("opens successful session command results in the Side Panel", async () => {
    const refineCommandId = "extension-lab.refine-ticket";
    const loadMetadata = mock(async () => ({
      ...metadata,
      commands: [{ id: refineCommandId, extensionId: "pstdio.extension-lab", title: "Refine ticket" }],
      menuContributions: [
        {
          ...metadata.menuContributions[0]!,
          commandId: refineCommandId,
          label: "Refine ticket",
        },
      ],
    }));
    const sessionResponse = {
      commandId: refineCommandId,
      extensionId: "pstdio.extension-lab",
      outcome: {
        ok: true,
        status: "success",
        value: {
          type: "session",
          id: "session-1",
          title: "Refine ticket: PS-1",
          status: "in_progress",
        },
      },
    } satisfies CommandExecuteResponse;
    const executeCommand = mock(async () => sessionResponse);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.registerModule(createSessionBubbleModule());
    workbench.sidePanel.setMode("closed");
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, executeCommand }));

    try {
      await flushMicrotasks();

      const labResource = workbench.resources.listResources("").find((entry) => entry.resource.id === "lab")?.resource;
      await workbench.resources.openResource(labResource!);

      const resourceActions = listWorkbenchMenuItems(workbench, resourceContextMenuPath("extension-route"), {
        resource: labResource,
      });
      await workbench.commands.executeCommand(resourceActions[0]!.commandId, undefined, { resource: labResource });

      const placement = workbench.layout
        .getLayout()
        .regions.side.widgets.find((widget) => widget.resource?.kind === "session");

      expect(workbench.sidePanel.getMode()).toBe("floating");
      expect(placement?.resource).toMatchObject({
        kind: "session",
        id: "session-1",
        label: "Refine ticket: PS-1",
        metadata: { status: "in_progress" },
      });
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("keeps contributions live while a same-project metadata refresh is in flight", async () => {
    const { metadataWithTickets } = await import("./module-test-fixtures");
    let resolveRefresh: ((value: typeof metadataWithTickets) => void) | undefined;
    let calls = 0;
    const loadMetadata = mock(() => {
      calls += 1;
      if (calls === 1) return Promise.resolve(metadataWithTickets);
      // Extension installs and webview builds emit collection churn whose refetch
      // can stay in flight for seconds; contributions must survive that window.
      return new Promise<typeof metadataWithTickets>((resolve) => {
        resolveRefresh = resolve;
      });
    });
    const workbench = createWorkbenchCore();
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    const ticketsBoardResource = {
      kind: "dashboard-view",
      uri: "dashboard-workbench://project/project-1/views/pstdio-core-tickets.tickets",
      id: "pstdio-core-tickets.tickets",
      label: "Tickets",
    };

    try {
      await flushMicrotasks();
      await workbench.resources.openResource(ticketsBoardResource);

      getWriter("installed_extension_sources")?.upsert({ id: "extension-lab" });
      await flushMicrotasks();

      // The refresh fetch has not resolved yet — the tickets opener must still exist.
      await workbench.resources.openResource(ticketsBoardResource);

      resolveRefresh?.(metadataWithTickets);
      await flushMicrotasks();
      await workbench.resources.openResource(ticketsBoardResource);
    } finally {
      disposable.dispose();
      getWriter("installed_extension_sources")?.truncateAndWrite([]);
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
