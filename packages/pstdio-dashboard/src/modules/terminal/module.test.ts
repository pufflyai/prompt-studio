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

const openedRequest = async (cwd?: string) => {
  const workbench = createWorkbench();
  workbench.registerModule(createTerminalModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

  void workbench.terminal.open({ request: { cols: 80, rows: 24, ...(cwd ? { cwd } : {}) } });
  await Promise.resolve();
  await Promise.resolve();

  const [message] = TestWebSocket.latest.sent;
  return message?.type === "open" ? message.request : undefined;
};

afterEach(() => {
  globalThis.WebSocket = nativeWebSocket;
  getWriter("workspaces")?.truncateAndWrite([]);
});

describe("dashboard terminal sessions", () => {
  test("start in the selected project's root when the request names no folder", async () => {
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
  });
});
