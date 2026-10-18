import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

describe("createWorkbenchWebviewHostCapabilities", () => {
  test("maps v1 webview capabilities onto workbench registries", async () => {
    const workbench = createWorkbench();
    const page = { extensionId: "pstdio.lab", kind: "page" as const, id: "tickets" };
    workbench.commands.registerCommand(
      { id: "lab.hello", label: "Hello" },
      { execute: (params) => ({ params, status: "ok" }) },
    );
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
      workbench,
    });
    await expect(
      capabilities["commands.execute"]?.({ commandId: "lab.hello", params: { name: "Ada" } }),
    ).resolves.toEqual({ outcome: { ok: true, status: "success", value: { params: { name: "Ada" }, status: "ok" } } });
    await expect(
      capabilities["navigation.open"]?.({
        target: { kind: "page", page },
      }),
    ).resolves.toBeUndefined();
    capabilities["notification.show"]?.({ type: "success", message: "Saved", metadata: { revision: 2 } });
    expect(workbench.notifications.listNotifications()).toMatchObject([{ title: "Saved", metadata: { revision: 2 } }]);
    capabilities["notification.show"]?.({ level: "info", title: "Bridge ready" });
    capabilities["preferences.set"]?.({ name: "lab.theme", scope: { scope: "user" }, value: "dark" });
    const preference = capabilities["preferences.get"]?.({ name: "lab.theme", scope: { scope: "user" } });
    expect(preference).toBe("dark");
    expect(workbench.pages.store.getState().activePageId).toBe("pstdio.lab.page.tickets");
    expect(workbench.notifications.listNotifications()).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Bridge ready" })]),
    );
  });
});
