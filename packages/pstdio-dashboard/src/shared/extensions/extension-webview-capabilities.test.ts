import { describe, expect, test } from "bun:test";
import type { createWorkbench } from "@pstdio/workbench";
import { createDashboardExtensionWebviewCapabilities } from "./extension-webview-capabilities";

describe("createDashboardExtensionWebviewCapabilities", () => {
  test("adds project-owned files without replacing dashboard handlers", () => {
    const commandsExecute = async () => "dashboard";
    const capabilities = createDashboardExtensionWebviewCapabilities({
      base: { "commands.execute": commandsExecute },
      extensionId: "pstdio.lab",
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
      extensionId: "pstdio.lab",
      projectId: "project-1",
      webviewId: "view-1",
    });

    expect(capabilities["files.upload"]).toBeUndefined();
    expect(capabilities["files.list"]).toBeUndefined();
    expect(capabilities["files.delete"]).toBeUndefined();
    expect(capabilities["artifacts.read"]).toBeUndefined();
  });

  test("adds navigation.open only when a workbench is available", async () => {
    const calls: unknown[] = [];
    const workbench = {
      navigation: { openTarget: async (target: unknown) => calls.push(target) },
    } as unknown as ReturnType<typeof createWorkbench>;
    const capabilities = createDashboardExtensionWebviewCapabilities({
      base: {},
      extensionId: "pstdio.lab",
      webviewId: "view-1",
      workbench,
    });

    await capabilities["navigation.open"]?.({ target: { kind: "page", page: { kind: "page", id: "tickets" } } });
    expect(calls).toEqual([
      {
        kind: "page",
        page: { extensionId: "pstdio.lab", kind: "page", id: "tickets" },
      },
    ]);
    expect(
      createDashboardExtensionWebviewCapabilities({ base: {}, extensionId: "pstdio.lab", webviewId: "view-1" })[
        "navigation.open"
      ],
    ).toBeUndefined();
  });
});
