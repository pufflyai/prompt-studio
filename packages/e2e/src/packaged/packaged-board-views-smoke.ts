import { expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const readSnapshot = async (baseUrl: string, headers: Record<string, string>) => {
  const controller = new AbortController();
  try {
    const response = await fetch(`${baseUrl}/v1/sync/stream`, { headers, signal: controller.signal });
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes("\n\n")) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error("Sync ended before its snapshot");
      text += decoder.decode(chunk.value, { stream: true });
    }
    const data = text
      .split("\n")
      .find((line) => line.startsWith("data: "))!
      .slice(6);
    return JSON.parse(data).tables;
  } finally {
    controller.abort();
  }
};

export const registerBoardViewsSmokeTests = () => {
  test("packaged board views support CLI edits and survive a runtime restart", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-board-views-"));
    let child: ChildProcess | undefined;
    const env = { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("pstdio-planner") };
    try {
      let runtime = await startPackagedServe(root, env);
      child = runtime.child;
      const folder = join(root, "project");
      mkdirSync(folder);
      const response = await fetch(`${runtime.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Shared views" }, folder)),
      });
      expect(response.status).toBe(201);
      const { id: projectId } = (await response.json()) as { id: string };
      const board = "pstdio.pstdio-planner.view.tickets";
      const cli = (...args: string[]) => {
        const result = spawnSync(PACKAGED_BINARY_PATH, ["views", ...args, "--project-id", projectId], {
          cwd: folder,
          encoding: "utf8",
          env: { ...process.env, HOME: root, PSTDIO_HOME: root, PSTDIO_API_URL: runtime.baseUrl },
        });
        expect(result.status, result.stderr).toBe(0);
        return JSON.parse(result.stdout);
      };
      const boards = cli("boards");
      expect(boards).toContainEqual(expect.objectContaining({ id: board }));
      const created = cli(
        "create",
        "--board",
        board,
        "--title",
        "Agent view",
        "--filter",
        "archived=Active",
        "--mode",
        "list",
      );
      expect(created).toMatchObject({
        title: "Agent view",
        builtIn: false,
        filters: { archived: ["active"] },
        settings: { viewMode: "list" },
      });
      cli("set-default", "--board", board, "--id", created.id);
      cli("update", "--id", created.id, "--title", "Shared default");
      await stopProcess(child);
      runtime = await startPackagedServe(root, env);
      child = runtime.child;
      const persisted = cli("list", "--board", board);
      expect(persisted.defaultViewId).toBe(created.id);
      expect(persisted.views).toContainEqual(
        expect.objectContaining({
          id: created.id,
          title: "Shared default",
          settings: expect.objectContaining({ viewMode: "list" }),
        }),
      );
      const snapshot = await readSnapshot(runtime.baseUrl, runtimeAuthorization(runtime.descriptor));
      expect(snapshot.board_views).toContainEqual(expect.objectContaining({ id: created.id, title: "Shared default" }));
      expect(snapshot.board_default_views).toContainEqual(
        expect.objectContaining({ id: expect.any(String), default_view_id: created.id }),
      );
      const copy = cli("create", "--board", board, "--title", "Copy", "--copy-from", created.id);
      expect(copy.filters).toEqual(created.filters);
      const ordered = cli("reorder", "--board", board, "--ids", `${copy.id},${created.id}`);
      expect(
        ordered.views.filter((view: { builtIn: boolean }) => !view.builtIn).map((view: { id: string }) => view.id),
      ).toEqual([copy.id, created.id]);
      cli("delete", "--id", created.id);
      expect(cli("list", "--board", board).defaultViewId).not.toBe(created.id);
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
};
