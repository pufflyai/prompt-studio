import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createExtensionWebviewHostCapabilities } from "./extension-webview-host-capabilities";
import { createWorkbenchExtensionWebviewAdapters } from "./webview-command-capabilities";

const createCapabilities =
  (input: Parameters<typeof createWorkbenchExtensionWebviewAdapters>[0]) =>
  (context: Parameters<ReturnType<typeof createWorkbenchExtensionWebviewAdapters>>[0]) =>
    createExtensionWebviewHostCapabilities(createWorkbenchExtensionWebviewAdapters(input)(context));

describe("extension webview command adapters", () => {
  test("preserves the requested workspace and command metadata", async () => {
    const requests: unknown[] = [];
    const capabilities = createCapabilities({
      executeCommand: (commandId, body) => {
        requests.push({ commandId, body });
        return { outcome: { ok: true, status: "success" } };
      },
      extensionIdForWebview: () => "notes",
      projectId: "project",
      slotKind: "panel",
    })({ placement: {}, webviewId: "notes", workbench: createWorkbench() } as never);
    await capabilities["commands.execute"]?.({
      commandId: "notes.command.read",
      workspaceId: "remote-workspace",
      metadata: { sourcePanel: "notes" },
    });
    expect(requests).toMatchObject([
      {
        commandId: "notes.command.read",
        body: { workspaceId: "remote-workspace", metadata: { sourcePanel: "notes" } },
      },
    ]);
  });

  test("navigation.open resolves page refs against the webview extension", async () => {
    const workbench = createWorkbench();
    const page = { extensionId: "pstdio.lab", kind: "page" as const, id: "tickets" };
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.views.registerView({
      id: "tickets",
      title: "Tickets",
      body: { kind: "react", render: () => null },
    });
    workbench.pages.registerPage({
      id: "pstdio.lab.page.tickets",
      ref: page,
      title: "Tickets",
      path: "tickets",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "tickets",
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.pageLocations.setProject("project-1");
    const capabilities = createCapabilities({
      executeCommand: async () => ({}),
      extensionIdForWebview: () => "pstdio.lab",
      projectId: "project-1",
      slotKind: "panel",
    })({
      placement: { resource: undefined },
      webviewId: "panel-1",
      workbench,
    } as never);
    await capabilities["navigation.open"]?.({ target: { kind: "page", page: { kind: "page", id: "tickets" } } });
    expect(workbench.pages.store.getState().activePageId).toBe("pstdio.lab.page.tickets");
  });
});

test("webview command calls apply navigation once and preserve the response envelope", async () => {
  const workbench = createWorkbench();
  workbench.pageLocations.setProject("project");
  let opened = 0;
  workbench.commands.registerCommand(
    { id: "open", label: "Open" },
    {
      execute: () => {
        opened++;
      },
    },
  );
  const response = {
    commandId: "notes.create",
    extensionId: "notes",
    outcome: {
      ok: true,
      status: "success",
      value: { id: "one" },
      navigationRequests: [
        { kind: "command", target: { command: { kind: "command", id: "open", extensionId: "pstdio" } } },
      ],
    },
  };
  const capabilities = createCapabilities({
    executeCommand: () => response,
    extensionIdForWebview: () => "notes",
    projectId: "project",
    slotKind: "panel",
  })({ placement: {}, webviewId: "notes", workbench } as never);
  expect(await capabilities["commands.execute"]?.({ commandId: "notes.create" })).toEqual(response);
  expect(opened).toBe(1);
});

test("webviews receive structured command rejections", async () => {
  const response = {
    outcome: { ok: false, status: "rejected", code: "needs_review", reason: "Review first", data: { revision: 2 } },
  };
  const capabilities = createCapabilities({
    executeCommand: () => response,
    extensionIdForWebview: () => "notes",
    projectId: "project",
    slotKind: "panel",
  })({ placement: {}, webviewId: "notes", workbench: createWorkbench() } as never);
  expect(await capabilities["commands.execute"]?.({ commandId: "notes.command.save" })).toEqual(response);
});
