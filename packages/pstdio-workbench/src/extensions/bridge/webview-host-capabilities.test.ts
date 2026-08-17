import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

describe("createWorkbenchWebviewHostCapabilities", () => {
  test("maps v1 webview capabilities onto workbench registries", async () => {
    const workbench = createWorkbenchCore();
    const keyboardEvents: unknown[] = [];
    const openedResources: unknown[] = [];

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
      closable: false,
    });
    workbench.resources.registerPresenter({
      id: "ticket-presenter",
      canOpen: (resource) => resource.kind === "ticket",
      open: (resource, input) => {
        openedResources.push({ input, resource });
        return workbench.layout.openPanel("ticket", { resource });
      },
    });
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
        input: { strategy: "replace-active" },
        resource: { kind: "ticket", uri: "pstdio://ticket/PS-276" },
      }),
    ).resolves.toMatchObject({
      panelId: "ticket",
      resourceUri: "pstdio://ticket/PS-276",
    });

    capabilities["notification.show"]?.({ level: "info", title: "Bridge ready" });
    capabilities["preferences.set"]?.({ name: "lab.theme", scope: { scope: "user" }, value: "dark" });
    const preference = capabilities["preferences.get"]?.({ name: "lab.theme", scope: { scope: "user" } });
    capabilities["host.dispatchKeyboardEvent"]?.({ code: "KeyP", ctrlKey: true, key: "p" });

    expect(preference).toBe("dark");
    expect(openedResources).toEqual([
      {
        input: { replaceActive: true },
        resource: { kind: "ticket", uri: "pstdio://ticket/PS-276" },
      },
    ]);
    expect(workbench.notifications.listNotifications()).toMatchObject([{ title: "Bridge ready" }]);
    expect(keyboardEvents).toEqual([{ code: "KeyP", ctrlKey: true, key: "p" }]);
  });
});
