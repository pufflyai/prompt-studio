import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createExtensionWebviewHostCapabilities } from "./webview-command-capabilities";

describe("createExtensionWebviewHostCapabilities", () => {
  test("resource.open normalizes the SDK resource shape (type) into a workbench resource (kind + uri)", async () => {
    const workbench = createWorkbenchCore();
    const opened: { kind: string; uri: string; id?: string; label?: string }[] = [];

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
      open: (resource) => {
        opened.push(resource);
        return workbench.layout.openPanel("ticket", { resource });
      },
    });

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

    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({
      kind: "ticket",
      uri: "pstdio://extension-resource/ticket/PS-15",
      id: "PS-15",
      label: "PS-15",
    });
  });
});
