import { describe, expect, test } from "bun:test";
import { createShellCore } from "pstdio-shell/core";
import { createShellWebviewHostCapabilities } from "./webview-host-capabilities";

describe("createShellWebviewHostCapabilities", () => {
  test("maps v1 webview capabilities onto shell registries", async () => {
    const shell = createShellCore();
    const keyboardEvents: unknown[] = [];
    const openedResources: unknown[] = [];

    shell.commands.registerCommand(
      { id: "lab.hello", label: "Hello" },
      { execute: (params) => ({ params, status: "ok" }) },
    );
    shell.resources.registerKind({ kind: "ticket", label: "Ticket" });
    shell.resources.registerOpener({
      id: "ticket-opener",
      canOpen: (resource) => resource.kind === "ticket",
      open: (resource, input) => {
        openedResources.push({ input, resource });
        return { opened: resource.uri };
      },
    });
    shell.preferences.registerSchema({
      properties: {
        "lab.theme": {
          default: "light",
          scope: "user",
          type: "string",
        },
      },
    });
    shell.activity.registerKind({ kind: "lab.event", title: "Lab event" });

    const capabilities = createShellWebviewHostCapabilities({
      dispatchKeyboardEvent: (event) => keyboardEvents.push(event),
      shell,
      webviewId: "lab.page",
    });

    await expect(
      capabilities["commands.execute"]?.({ commandId: "lab.hello", params: { name: "Ada" } }),
    ).resolves.toEqual({
      params: { name: "Ada" },
      status: "ok",
    });
    await expect(
      capabilities["resource.open"]?.({
        input: { replaceActive: true },
        resource: { kind: "ticket", uri: "pstdio://ticket/PS-276" },
      }),
    ).resolves.toEqual({ opened: "pstdio://ticket/PS-276" });

    capabilities["notification.show"]?.({ level: "info", title: "Bridge ready" });
    capabilities["preferences.set"]?.({ name: "lab.theme", scope: { scope: "user" }, value: "dark" });
    const preference = capabilities["preferences.get"]?.({ name: "lab.theme", scope: { scope: "user" } });
    capabilities["activity.emit"]?.({
      createdAt: "2026-05-13T00:00:00.000Z",
      id: "activity-1",
      kind: "lab.event",
      title: "Lab event",
    });
    capabilities["diagnostics.report"]?.({
      id: "diagnostic-1",
      message: "Lab diagnostic",
      severity: "warning",
      source: "lab.webview",
    });
    capabilities["host.dispatchKeyboardEvent"]?.({ code: "KeyP", ctrlKey: true, key: "p" });

    expect(preference).toBe("dark");
    expect(openedResources).toEqual([
      {
        input: { replaceActive: true },
        resource: { kind: "ticket", uri: "pstdio://ticket/PS-276" },
      },
    ]);
    expect(shell.notifications.listNotifications()).toMatchObject([{ title: "Bridge ready" }]);
    expect(shell.activity.listItems()).toMatchObject([{ id: "activity-1", kind: "lab.event" }]);
    expect(shell.diagnostics.listDiagnostics()).toMatchObject([{ id: "diagnostic-1", source: "lab.webview" }]);
    expect(keyboardEvents).toEqual([{ code: "KeyP", ctrlKey: true, key: "p" }]);
  });
});
