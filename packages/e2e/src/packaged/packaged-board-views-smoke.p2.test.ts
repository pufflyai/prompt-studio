import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WORKSPACES_COLLECTION_ID } from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { runTestCommand } from "../scripts/run-test-command";
import { preparePackagedExtensionSource } from "./packaged-extension-source";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

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

const createViewsCli =
  (input: { folder: string; root: string; projectId: string; baseUrl: () => string }) =>
  async (...args: string[]) => {
    const started = performance.now();
    // Keep the test event loop available to drain the API process's output and I/O.
    const result = await runTestCommand(PACKAGED_BINARY_PATH, ["views", ...args, "--project-id", input.projectId], {
      cwd: input.folder,
      env: { ...process.env, HOME: input.root, PSTDIO_HOME: input.root, PSTDIO_API_URL: input.baseUrl() },
    });
    console.info(`Packaged board views ${args[0]}: ${Math.round(performance.now() - started)} ms`);
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout);
  };

let sources: string;
let env: Record<string, string>;
setupPackagedSmokeTests(async () => {
  sources = mkdtempSync(join(tmpdir(), "packaged-board-sources-"));
  // This test owns board persistence. Install its packed public dependencies during fixture setup;
  // cold extension installation has separate smoke coverage and timing evidence.
  const defaultExtensions = await Promise.all(
    ["pstdio-planner", "pstdio-workspaces"].map(async (installName) => ({
      installName,
      skipInstall: true,
      source: await preparePackagedExtensionSource(
        join(sources, installName),
        join(import.meta.dirname, "../../../../extensions", installName),
        { install: true },
      ),
    })),
  );
  env = { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({ defaultExtensions }) };
});

test("packaged collection views include native Workspaces and survive a runtime restart", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-board-views-"));
  let child: ChildProcess | undefined;
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
    const board = "pstdio.planner.view.tickets";
    const cli = createViewsCli({ folder, root, projectId, baseUrl: () => runtime.baseUrl });
    const boards = await cli("boards");
    const initial = (await cli("list", "--board", board)).views[0];
    expect(initial.builtIn).toBe(false);
    expect(await cli("update", "--id", initial.id, "--title", "My tickets", "--filter", "none")).toMatchObject({
      title: "My tickets",
      filter: { conjunction: "and", rules: [] },
    });
    expect(boards).toContainEqual(expect.objectContaining({ id: board, kind: "kanban" }));
    expect(boards).toContainEqual(
      expect.objectContaining({ id: "pstdio.workspaces.view.workspaces", kind: "resourceList" }),
    );
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
    const workspaces = await cli(
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
    await cli("set-default", "--board", WORKSPACES_COLLECTION_ID, "--id", workspaces.id);
    const created = await cli(
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
    const invalidSort = await runTestCommand(
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
        env: { ...process.env, HOME: root, PSTDIO_HOME: root, PSTDIO_API_URL: runtime.baseUrl },
      },
      1,
    );
    expect(invalidSort.status).not.toBe(0);
    expect(invalidSort.stderr).toContain("one sort");
    await cli("set-default", "--board", board, "--id", created.id);
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
    const updated = await cli(
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
    const persisted = await cli("list", "--board", board);
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
    expect(await cli("list", "--board", WORKSPACES_COLLECTION_ID)).toMatchObject({ defaultViewId: workspaces.id });
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
    const copy = await cli("create", "--board", board, "--title", "Copy", "--copy-from", created.id);
    expect(copy).toMatchObject({ filter, sorts: created.sorts });
    const ordered = await cli("reorder", "--board", board, "--ids", `${copy.id},${created.id},${initial.id}`);
    expect(
      ordered.views.filter((view: { builtIn: boolean }) => !view.builtIn).map((view: { id: string }) => view.id),
    ).toEqual([copy.id, created.id, initial.id]);
    await cli("delete", "--id", initial.id);
    await cli("delete", "--id", created.id);
    expect(await cli("list", "--board", board)).toMatchObject({ defaultViewId: copy.id, views: [{ id: copy.id }] });
    const last = await fetch(`${runtime.baseUrl}/v1/projects/${projectId}/board-views/${copy.id}`, {
      method: "DELETE",
      headers: runtimeAuthorization(runtime.descriptor),
    });
    expect(last.status).toBe(409);
    expect((await cli("list", "--board", board)).views).toHaveLength(1);
  } finally {
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
    rmSync(sources, { recursive: true, force: true });
  }
}, 30_000);
