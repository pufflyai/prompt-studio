import { describe, expect, test } from "bun:test";
import type { TerminalSessionBridgeRequest } from "@pstdio/sdk/extensions";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { createWorkbenchCore } from "../../core";
import {
  createExtensionWebviewHostCapabilities,
  type ExtensionWebviewTerminalCapability,
} from "./webview-command-capabilities";

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

  test("terminal.session dispatches to the supplied terminal capability", async () => {
    const workbench = createWorkbenchCore();
    const received: Array<{ ownerId?: string; request: TerminalSessionBridgeRequest }> = [];
    const terminal: ExtensionWebviewTerminalCapability = {
      session(request, ownerId) {
        received.push({ ownerId, request });
        if (request.op === "open") return { op: "open", sessionId: "session-1" };
        return { op: "ack" };
      },
    };

    const capabilities = createExtensionWebviewHostCapabilities({
      executeCommand: async () => ({}),
      projectId: "proj-1",
      slotKind: "view",
      terminal,
    })({
      placement: { resource: undefined },
      webviewId: "view-1",
      workbench,
    } as never);

    expect(await capabilities["terminal.session"]?.({ op: "open", request: { cols: 80, rows: 24 } })).toEqual({
      op: "open",
      sessionId: "session-1",
    });
    expect(await capabilities["terminal.session"]?.({ op: "write", sessionId: "session-1", data: "ls\n" })).toEqual({
      op: "ack",
    });
    expect(received).toEqual([
      { ownerId: "view-1", request: { op: "open", request: { cols: 80, rows: 24 } } },
      { ownerId: "view-1", request: { op: "write", sessionId: "session-1", data: "ls\n" } },
    ]);
  });

  test("terminal.session is absent when no terminal capability is supplied", () => {
    const workbench = createWorkbenchCore();
    const capabilities = createExtensionWebviewHostCapabilities({
      executeCommand: async () => ({}),
      projectId: "proj-1",
      slotKind: "view",
    })({
      placement: { resource: undefined },
      webviewId: "view-1",
      workbench,
    } as never);

    expect(capabilities["terminal.session"]).toBeUndefined();
  });

  test("gate rejects terminal.session calls from webviews that didn't declare it", async () => {
    const workbench = createWorkbenchCore();
    const terminal: ExtensionWebviewTerminalCapability = {
      session: () => ({ op: "ack" }),
    };

    const capabilities = createExtensionWebviewHostCapabilities({
      executeCommand: async () => ({}),
      projectId: "proj-1",
      slotKind: "view",
      terminal,
    })({
      placement: { resource: undefined },
      webviewId: "view-1",
      workbench,
    } as never);

    const gate = createHostCapabilityGate({
      capabilities,
      declaredCapabilities: [],
    });

    await expect(
      gate.call({ method: "terminal.session", params: { op: "open", request: { cols: 80, rows: 24 } } }),
    ).rejects.toThrow(/did not declare host capability: terminal.session/);
  });
});
