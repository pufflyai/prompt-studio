import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { createExtensionWebviewHostCapabilities } from "./webview-command-capabilities";

describe("createExtensionWebviewHostCapabilities", () => {
  test("resource.open normalizes the SDK resource shape (type) into a workbench resource (kind + uri)", async () => {
    const workbench = createWorkbenchCore();
    const opened: { kind: string; uri: string; id?: string; label?: string }[] = [];

    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    workbench.resources.registerOpener({
      id: "ticket-opener",
      canOpen: (resource) => resource.kind === "ticket",
      open: (resource) => {
        opened.push(resource);
        return { opened: resource.uri };
      },
    });

    const capabilities = createExtensionWebviewHostCapabilities({
      executeCommand: async () => ({}),
      projectId: "proj-1",
      slotKind: "view",
    })({
      placement: { resource: undefined },
      webviewId: "view-1",
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
