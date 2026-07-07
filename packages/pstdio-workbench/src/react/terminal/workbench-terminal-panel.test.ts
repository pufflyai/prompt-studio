import { describe, expect, test } from "bun:test";
import { createWorkbenchTerminalController, type ResourceRef, type WorkbenchTerminalSessionRequest } from "../../core";
import { createControllerTerminalBridge } from "./workbench-terminal-panel";

const workspaceResource: ResourceRef = {
  kind: "workspace",
  id: "workspace-1",
  uri: "dashboard-workbench://workspace/workspace-1",
  metadata: { workspacePath: "/repo/.pstdio/workspaces/PS-307_A1" },
};

const createAdapter = (id: string) => ({
  id,
  write() {},
  resize() {},
  kill() {},
  onData() {
    return () => {};
  },
  onTitle() {
    return () => {};
  },
  onExit() {
    return () => {};
  },
  onError() {
    return () => {};
  },
});

describe("createControllerTerminalBridge", () => {
  test("defaults terminal sessions to the workspace resource path", async () => {
    const terminal = createWorkbenchTerminalController();
    const requests: WorkbenchTerminalSessionRequest[] = [];
    terminal.setSessionOpener(async (request) => {
      requests.push(request);
      return createAdapter("terminal-1");
    });
    const bridge = createControllerTerminalBridge(terminal, { getResource: () => workspaceResource });

    await bridge.openSession({ cols: 80, rows: 24 });

    expect(requests).toEqual([{ cols: 80, rows: 24, cwd: "/repo/.pstdio/workspaces/PS-307_A1" }]);
  });

  test("preserves explicit terminal session cwd", async () => {
    const terminal = createWorkbenchTerminalController();
    const requests: WorkbenchTerminalSessionRequest[] = [];
    terminal.setSessionOpener(async (request) => {
      requests.push(request);
      return createAdapter("terminal-1");
    });
    const bridge = createControllerTerminalBridge(terminal, { getResource: () => workspaceResource });

    await bridge.openSession({ cols: 80, rows: 24, cwd: "/tmp/manual" });

    expect(requests).toEqual([{ cols: 80, rows: 24, cwd: "/tmp/manual" }]);
  });
});
