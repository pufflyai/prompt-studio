import { afterEach, describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import type { TerminalWebSocketClientMessage } from "pstdio-api-contracts";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createTerminalModule } from "./module";

const nativeWebSocket = globalThis.WebSocket;

class TestWebSocket extends EventTarget {
  static readonly OPEN = 1;
  static latest: TestWebSocket;

  readonly sent: TerminalWebSocketClientMessage[] = [];
  readyState = TestWebSocket.OPEN;

  constructor() {
    super();
    TestWebSocket.latest = this;
    queueMicrotask(() => this.dispatchEvent(new Event("open")));
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close() {}
}

const openedRequest = async (cwd?: string, native = false) => {
  const workbench = createWorkbench();
  workbench.registerModule(createTerminalModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

  void workbench.terminal.open({
    request: { cols: 80, rows: 24, ...(cwd ? { cwd } : {}) },
    ...(native ? { view: { projectId: "project-1", viewId: "tool.view.terminal" } } : {}),
  });
  await Promise.resolve();
  await Promise.resolve();

  const [message] = TestWebSocket.latest.sent;
  return message?.type === "open" || message?.type === "openView" ? message.request : undefined;
};

afterEach(() => {
  globalThis.WebSocket = nativeWebSocket;
  getWriter("workspaces")?.truncateAndWrite([]);
});

describe("dashboard terminal sessions", () => {
  test("legacy unbound sessions use the selected project's folder and preserve explicit folders", async () => {
    globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;
    getWriter("workspaces")?.truncateAndWrite([
      {
        id: "workspace-1",
        project_id: "project-1",
        name: "Root repo",
        root_path: "/repo/prompt-studio",
        workspace_shorthand: "ROOT",
        is_default: true,
      },
      {
        id: "workspace-2",
        project_id: "project-1",
        name: "PS-1_A1",
        root_path: "/repo/.pstdio/workspaces/PS-1_A1",
        workspace_shorthand: "PS-1_A1",
        is_default: false,
      },
    ]);

    expect(await openedRequest()).toMatchObject({ cwd: "/repo/prompt-studio" });
    expect(await openedRequest("/repo/.pstdio/workspaces/PS-1_A1")).toMatchObject({
      cwd: "/repo/.pstdio/workspaces/PS-1_A1",
    });
    expect(await openedRequest(undefined, true)).toEqual({
      projectId: "project-1",
      viewId: "tool.view.terminal",
      cols: 80,
      rows: 24,
    });
  });
});

test("the legacy open command delegates to the installed terminal tool with its invoking workspace", async () => {
  const workbench = createWorkbench();
  const calls: unknown[] = [];
  workbench.commands.registerCommand(
    { id: "pstdio.pstdio-terminal.command.open", label: "Open terminal" },
    {
      execute: (args, context) => {
        calls.push({ args, resource: context?.resource });
      },
    },
  );
  workbench.registerModule(createTerminalModule());
  const resource = { type: "workspace", id: "selected", projectId: "project-1" };
  try {
    await workbench.commands.executeCommand("workbench.terminal.open", undefined, { resource });
    expect(calls).toEqual([{ args: undefined, resource }]);
  } finally {
    await workbench.dispose();
  }
});
