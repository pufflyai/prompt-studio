import { expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WORKSPACES_COLLECTION_ID } from "pstdio-api-contracts";
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
  test("packaged collection views include native Workspaces and survive a runtime restart", async () => {
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
      const initial = cli("list", "--board", board).views[0];
      expect(initial.builtIn).toBe(false);
      expect(cli("update", "--id", initial.id, "--title", "My tickets", "--filter", "none")).toMatchObject({
        title: "My tickets",
        filter: { conjunction: "and", rules: [] },
      });
      expect(boards).toContainEqual(expect.objectContaining({ id: board, kind: "kanban" }));
      expect(boards).toContainEqual(expect.objectContaining({ id: WORKSPACES_COLLECTION_ID, extensionId: null }));
      const nativeFields = boards.find((entry: { id: string }) => entry.id === WORKSPACES_COLLECTION_ID).fields;
      expect(nativeFields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "diff", filterable: false, sortable: true, displayable: true }),
        ]),
      );
      const refusedDiff = await fetch(
        `${runtime.baseUrl}/v1/projects/${projectId}/boards/${WORKSPACES_COLLECTION_ID}/views`,
        {
          method: "POST",
          headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
          body: JSON.stringify({
            title: "Diff filter",
            filter: { conjunction: "and", rules: [{ attributeId: "diff", condition: "gt", value: 5 }] },
          }),
        },
      );
      expect(refusedDiff.status).toBe(400);
      const workspaces = cli(
        "create",
        "--board",
        WORKSPACES_COLLECTION_ID,
        "--title",
        "Workspace view",
        "--filter",
        "name contains release",
        "--sort",
        "created:desc",
        "--group",
        "type",
        "--stats",
        "on",
      );
      cli("set-default", "--board", WORKSPACES_COLLECTION_ID, "--id", workspaces.id);
      const created = cli(
        "create",
        "--board",
        board,
        "--title",
        "Agent view",
        "--filter",
        "archived is-any-of Active",
        "--filter",
        "status is-none-of done",
        "--sort",
        "updated:desc",
        "--mode",
        "list",
      );
      expect(created).toMatchObject({
        title: "Agent view",
        builtIn: false,
        filter: {
          conjunction: "and",
          rules: [
            { attributeId: "archived", condition: "is-any-of", value: ["active"] },
            { attributeId: "status", condition: "is-none-of", value: ["done"] },
          ],
        },
        sorts: [{ attributeId: "updated", direction: "desc" }],
        settings: { viewMode: "list" },
      });
      const invalidSort = spawnSync(
        PACKAGED_BINARY_PATH,
        [
          "views",
          "update",
          "--id",
          created.id,
          "--sort",
          "updated:desc",
          "--sort",
          "created:asc",
          "--project-id",
          projectId,
        ],
        {
          cwd: folder,
          encoding: "utf8",
          env: { ...process.env, HOME: root, PSTDIO_HOME: root, PSTDIO_API_URL: runtime.baseUrl },
        },
      );
      expect(invalidSort.status).not.toBe(0);
      expect(invalidSort.stderr).toContain("one sort");
      cli("set-default", "--board", board, "--id", created.id);
      const filter = {
        conjunction: "and",
        rules: [{ attributeId: "title", condition: "does-not-contain", value: "archived" }],
        groups: [
          {
            conjunction: "or",
            rules: [
              { attributeId: "title", condition: "contains", value: "review" },
              { attributeId: "status", condition: "is-any-of", value: ["done"] },
            ],
          },
        ],
      };
      const updated = cli(
        "update",
        "--id",
        created.id,
        "--title",
        "Shared default",
        "--filter-json",
        JSON.stringify(filter),
      );
      expect(updated.filter).toEqual(filter);
      await stopProcess(child);
      runtime = await startPackagedServe(root, env);
      child = runtime.child;
      const persisted = cli("list", "--board", board);
      expect(persisted.views).toContainEqual(expect.objectContaining({ id: initial.id, title: "My tickets" }));
      expect(persisted.defaultViewId).toBe(created.id);
      expect(persisted.views).toContainEqual(
        expect.objectContaining({
          id: created.id,
          title: "Shared default",
          filter,
          settings: expect.objectContaining({ viewMode: "list" }),
        }),
      );
      const snapshot = await readSnapshot(runtime.baseUrl, runtimeAuthorization(runtime.descriptor));
      expect(cli("list", "--board", WORKSPACES_COLLECTION_ID)).toMatchObject({ defaultViewId: workspaces.id });
      expect(snapshot.board_views).toContainEqual(
        expect.objectContaining({
          id: workspaces.id,
          board_id: WORKSPACES_COLLECTION_ID,
          extension_instance_id: null,
          settings: expect.objectContaining({ grouping: "type", showStats: true }),
        }),
      );
      expect(snapshot.board_default_views).toContainEqual(
        expect.objectContaining({
          id: JSON.stringify([projectId, null, WORKSPACES_COLLECTION_ID]),
          default_view_id: workspaces.id,
        }),
      );
      expect(snapshot.board_views).toContainEqual(
        expect.objectContaining({
          id: created.id,
          title: "Shared default",
          filter,
          sorts: created.sorts,
        }),
      );
      expect(snapshot.board_default_views).toContainEqual(
        expect.objectContaining({ id: expect.any(String), default_view_id: created.id }),
      );
      const copy = cli("create", "--board", board, "--title", "Copy", "--copy-from", created.id);
      expect(copy).toMatchObject({ filter, sorts: created.sorts });
      const ordered = cli("reorder", "--board", board, "--ids", `${copy.id},${created.id},${initial.id}`);
      expect(
        ordered.views.filter((view: { builtIn: boolean }) => !view.builtIn).map((view: { id: string }) => view.id),
      ).toEqual([copy.id, created.id, initial.id]);
      cli("delete", "--id", initial.id);
      cli("delete", "--id", created.id);
      expect(cli("list", "--board", board)).toMatchObject({ defaultViewId: copy.id, views: [{ id: copy.id }] });
      const last = await fetch(`${runtime.baseUrl}/v1/projects/${projectId}/board-views/${copy.id}`, {
        method: "DELETE",
        headers: runtimeAuthorization(runtime.descriptor),
      });
      expect(last.status).toBe(409);
      expect(cli("list", "--board", board).views).toHaveLength(1);
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
};
