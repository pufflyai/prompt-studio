import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createExtensionWebviewHostCapabilities } from "./webview-command-capabilities";

describe("createExtensionWebviewHostCapabilities", () => {
  test("resource.open emits the SDK resource into the active page's bindings", async () => {
    const workbench = createWorkbenchCore();

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

    const capabilities = createExtensionWebviewHostCapabilities({
      executeCommand: async () => ({}),
      projectId: "proj-1",
      slotKind: "panel",
    })({
      placement: { resource: undefined },
      webviewId: "panel-1",
      workbench,
    } as never);

    await capabilities["resource.open"]?.({ resource: { type: "ticket", id: "PS-15", label: "PS-15" } });

    expect(workbench.layout.listPanelInstances("main")).toContainEqual(
      expect.objectContaining({
        panelId: "ticket",
        resource: expect.objectContaining({
          kind: "ticket",
          uri: "pstdio://extension-resource/ticket/PS-15",
          id: "PS-15",
          label: "PS-15",
        }),
      }),
    );
  });
});
