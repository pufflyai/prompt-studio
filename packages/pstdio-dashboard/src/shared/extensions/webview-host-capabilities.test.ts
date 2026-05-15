import { describe, expect, test } from "bun:test";
import { createDashboardWebviewHostCapabilities } from "./webview-host-capabilities";

describe("createDashboardWebviewHostCapabilities", () => {
  test("maps v1 webview capabilities onto dashboard operations", async () => {
    const executedCommands: unknown[] = [];
    const notifications: unknown[] = [];
    const themePreferences: string[] = [];
    const openedResources: unknown[] = [];
    const keyboardEvents: unknown[] = [];

    const capabilities = createDashboardWebviewHostCapabilities({
      dispatchKeyboardEvent: (event) => keyboardEvents.push(event),
      executeCommand: async (input) => {
        executedCommands.push(input);
        return { commandId: input.commandId, outcome: { ok: true, status: "success" } };
      },
      openResource: (input) => openedResources.push(input),
      projectId: "project-1",
      setThemePreference: (preference) => themePreferences.push(preference),
      showNotification: (notification) => notifications.push(notification),
      themePreference: "pstdio-light",
    });

    await capabilities["commands.execute"]?.({ commandId: "lab.hello", params: { name: "Ada" } });
    capabilities["notification.show"]?.({ level: "success", title: "Hello", message: "From lab" });
    capabilities["preferences.set"]?.({ name: "dashboard.themePreference", value: "pstdio-dark" });
    const theme = capabilities["preferences.get"]?.({ name: "dashboard.themePreference" });
    capabilities["resource.open"]?.({ href: "/projects/project-1/settings" });
    capabilities["host.dispatchKeyboardEvent"]?.({ code: "KeyP", ctrlKey: true, key: "p" });

    expect(executedCommands).toEqual([
      {
        body: { params: { name: "Ada" }, source: "dashboard" },
        commandId: "lab.hello",
      },
    ]);
    expect(notifications).toEqual([{ level: "success", message: "From lab", title: "Hello" }]);
    expect(themePreferences).toEqual(["pstdio-dark"]);
    expect(theme).toBe("pstdio-light");
    expect(openedResources).toEqual([{ href: "/projects/project-1/settings" }]);
    expect(keyboardEvents).toEqual([{ code: "KeyP", ctrlKey: true, key: "p" }]);
  });
});
