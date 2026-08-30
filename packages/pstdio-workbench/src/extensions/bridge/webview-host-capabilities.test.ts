import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

describe("createWorkbenchWebviewHostCapabilities", () => {
  test("maps v1 webview capabilities onto workbench registries", async () => {
    const workbench = createWorkbenchCore();
    const keyboardEvents: unknown[] = [];

    workbench.commands.registerCommand(
      { id: "lab.hello", label: "Hello" },
      { execute: (params) => ({ params, status: "ok" }) },
    );
    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    workbench.layout.registerPanel({
      id: "ticket",
      title: "Ticket",
      region: "main",
      rendererId: "test",
    });
    workbench.pages.registry.registerPage({
      id: "pstdio.lab.page.tickets",
      title: "Tickets",
      extensionId: "pstdio.lab",
      slots: [{ id: "ticket", region: "main", cardinality: "many" }],
      bindings: [{ kind: "ticket", panelId: "ticket", slot: "ticket" }],
    });
    await workbench.pages.activatePage("pstdio.lab.page.tickets");
    workbench.preferences.registerSchema({
      properties: {
        "lab.theme": {
          default: "light",
          scope: "user",
          type: "string",
        },
      },
    });

    const capabilities = createWorkbenchWebviewHostCapabilities({
      dispatchKeyboardEvent: (event) => keyboardEvents.push(event),
      workbench,
    });

    await expect(
      capabilities["commands.execute"]?.({ commandId: "lab.hello", params: { name: "Ada" } }),
    ).resolves.toEqual({
      params: { name: "Ada" },
      status: "ok",
    });
    await expect(
      capabilities["resource.open"]?.({
        resource: { kind: "ticket", uri: "pstdio://ticket/PS-276" },
      }),
    ).resolves.toMatchObject({
      instanceId: expect.any(String),
    });

    capabilities["notification.show"]?.({ level: "info", title: "Bridge ready" });
    capabilities["preferences.set"]?.({ name: "lab.theme", scope: { scope: "user" }, value: "dark" });
    const preference = capabilities["preferences.get"]?.({ name: "lab.theme", scope: { scope: "user" } });
    capabilities["host.dispatchKeyboardEvent"]?.({ code: "KeyP", ctrlKey: true, key: "p" });

    expect(preference).toBe("dark");
    expect(workbench.layout.listPanelInstances("main")).toContainEqual(
      expect.objectContaining({ panelId: "ticket", resourceUri: "pstdio://ticket/PS-276" }),
    );
    expect(workbench.notifications.listNotifications()).toMatchObject([{ title: "Bridge ready" }]);
    expect(keyboardEvents).toEqual([{ code: "KeyP", ctrlKey: true, key: "p" }]);
  });

  test("opens a kind the active page does not bind through its presenter", async () => {
    const workbench = createWorkbenchCore();
    const opened: string[] = [];

    workbench.resources.registerKind({ kind: "workspace", label: "Workspace" });
    workbench.layout.registerPanel({ id: "board", title: "Board", region: "main", rendererId: "test" });
    workbench.pages.registry.registerPage({
      id: "pstdio.lab.page.board",
      title: "Board",
      extensionId: "pstdio.lab",
      slots: [{ id: "board", region: "main", panelId: "board", closable: false }],
    });
    await workbench.pages.activatePage("pstdio.lab.page.board");
    // A native kind keeps its presenter: the page binds nothing, but the workbench
    // still knows where a workspace goes.
    workbench.resources.registerPresenter({
      id: "workspace.presenter",
      canOpen: (resource) => resource.kind === "workspace",
      open: (resource) => {
        opened.push(resource.uri);
        return workbench.layout.openPanel("board", { resource });
      },
    });

    const capabilities = createWorkbenchWebviewHostCapabilities({ workbench });
    await capabilities["resource.open"]?.({ resource: { kind: "workspace", uri: "pstdio://workspace/a" } });

    expect(opened).toEqual(["pstdio://workspace/a"]);
  });
});
