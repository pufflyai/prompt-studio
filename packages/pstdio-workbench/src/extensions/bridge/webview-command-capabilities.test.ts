import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createExtensionWebviewHostCapabilities } from "./webview-command-capabilities";

describe("createExtensionWebviewHostCapabilities", () => {
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
    const capabilities = createExtensionWebviewHostCapabilities({
      executeCommand: async () => ({}),
      extensionIdForWebview: () => "pstdio.lab",
      projectId: "proj-1",
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
  const capabilities = createExtensionWebviewHostCapabilities({
    executeCommand: () => response,
    extensionIdForWebview: () => "notes",
    projectId: "project",
    slotKind: "panel",
  })({ placement: {}, webviewId: "notes", workbench } as never);
  expect(await capabilities["commands.execute"]?.({ commandId: "notes.create" })).toEqual(response);
  expect(opened).toBe(1);
});
