import { describe, expect, test } from "bun:test";
import type { createWorkbenchCore } from "@pstdio/workbench";
import { createDashboardExtensionWebviewCapabilities } from "./extension-webview-capabilities";

describe("createDashboardExtensionWebviewCapabilities", () => {
  test("adds project-owned files without replacing dashboard handlers", () => {
    const commandsExecute = async () => "dashboard";
    const capabilities = createDashboardExtensionWebviewCapabilities({
      base: { "commands.execute": commandsExecute },
      extensionInstanceId: "instance-1",
      projectId: "project-1",
      webviewId: "view-1",
    });

    expect(capabilities["commands.execute"]).toBe(commandsExecute);
    expect(capabilities["files.upload"]).toBeFunction();
    expect(capabilities["files.list"]).toBeFunction();
    expect(capabilities["files.delete"]).toBeFunction();
    expect(capabilities["artifacts.read"]).toBeFunction();
  });

  test("does not add owner-backed capabilities without both owner ids", () => {
    const capabilities = createDashboardExtensionWebviewCapabilities({
      base: {},
      projectId: "project-1",
      webviewId: "view-1",
    });

    expect(capabilities["files.upload"]).toBeUndefined();
    expect(capabilities["files.list"]).toBeUndefined();
    expect(capabilities["files.delete"]).toBeUndefined();
    expect(capabilities["artifacts.read"]).toBeUndefined();
  });

  test("adds resource.open only when a workbench is available", async () => {
    const calls: unknown[] = [];
    const workbench = {
      resources: {
        openResource: async (resource: unknown) => {
          calls.push(resource);
        },
      },
    } as unknown as ReturnType<typeof createWorkbenchCore>;
    const capabilities = createDashboardExtensionWebviewCapabilities({
      base: {},
      webviewId: "view-1",
      workbench,
    });

    await capabilities["resource.open"]?.({ resource: { type: "ticket", id: "PS-1" } });
    expect(calls).toEqual([
      {
        id: "PS-1",
        kind: "ticket",
        uri: "pstdio://extension-resource/ticket/PS-1",
        label: undefined,
        metadata: undefined,
      },
    ]);
    expect(
      createDashboardExtensionWebviewCapabilities({ base: {}, webviewId: "view-1" })["resource.open"],
    ).toBeUndefined();
  });
});
