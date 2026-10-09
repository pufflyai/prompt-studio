import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { EventBus } from "../../sync/event-bus";
import { createProjectExtensionRuntimeCatalog } from "../project-extension-runtime-catalog";
import { createArtifactMountWatchService } from "./watch-service";
import { createArtifactMountWriteLedger } from "./write-ledger";

type HookCall = { mount: string; paths: string[]; projectId: string; workspaceId?: string };
type WatchState = { calls: HookCall[]; hookGate?: Promise<void> };

const services: Array<{ dispose: () => Promise<void> }> = [];
const cleanups: Array<() => void> = [];

afterEach(async () => {
  // Windows cannot remove a folder while a watch handle on it is open.
  for (const service of services.splice(0)) await service.dispose();
  for (const cleanup of cleanups.splice(0)) cleanup();
  delete (globalThis as Record<string, unknown>).__artifactWatchState;
});

const tempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

const waitFor = async (check: () => boolean, timeoutMs = 3_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for an artifact change");
    await Bun.sleep(10);
  }
};

// The hook writes into the mount it watches. Without echo suppression, it would run forever.
const writeDashboardsExtension = () => {
  const sourcePath = tempDir("pstdio-artifact-watch-ext-");
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "dashboards",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      type: "module",
    }),
  );
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `
      export default {
        artifactMounts: [
          { id: "boards", ref: { kind: "artifact-mount", id: "boards" }, path: "boards", label: "Boards", watch: true },
          { id: "runs", ref: { kind: "artifact-mount", id: "runs" }, path: "runs", label: "Runs" },
        ],
        hooks: [
          {
            id: "index-boards",
            ref: { kind: "hook", id: "index-boards" },
            event: { kind: "event", id: "artifact.changed:boards" },
            async run(ctx, payload) {
              globalThis.__artifactWatchState.calls.push(payload);
              await globalThis.__artifactWatchState.hookGate;
              await ctx.artifacts.mount("boards").writeText("index.json", JSON.stringify(payload.paths));
            },
          },
        ],
      };
    `,
  );
  return sourcePath;
};

const createHarness = (listProjectIds = async () => ["project-1"]) => {
  const state: WatchState = { calls: [] };
  (globalThis as Record<string, unknown>).__artifactWatchState = state;
  const sourcePath = writeDashboardsExtension();
  const workspace = {
    id: "workspace-1",
    project_id: "project-1",
    execution_kind: "local",
    provider_state: "ready",
    root_path: tempDir("pstdio-artifact-watch-repo-") as string | null,
  };
  let enabled = true;
  const extensionService = {
    listEnabledSourcesForProject: async () =>
      enabled
        ? [
            {
              instance: { id: "instance-1" },
              installedSource: {
                id: "source-1",
                extension_id: "pstdio.dashboards",
                source_kind: "local_path",
                source_path: sourcePath,
                status: "loaded",
              },
            },
          ]
        : [],
  };
  const workspaceService = { get: async () => workspace, getDefault: async () => workspace };
  const projectService = { get: async () => ({ id: "project-1", name: "Project", shorthand: "PS" }) };
  const eventBus = new EventBus();
  const catalog = createProjectExtensionRuntimeCatalog({
    extensionService: extensionService as never,
    projectService: projectService as never,
    workspaceService: workspaceService as never,
  });
  const service = createArtifactMountWatchService({
    deps: {
      artifactMountWrites: createArtifactMountWriteLedger(),
      eventBus,
      extensionRuntimeCatalog: catalog,
      extensionService,
      projectService,
      workspaceService,
    } as never,
    listProjectIds,
  });
  services.push(service);

  const boards = (root = workspace.root_path) =>
    join(root ?? "", ".pstdio", "extension-storage", "dashboards", "boards");
  const changeEvents = () =>
    eventBus
      .getSince(0)
      .filter((event) => event.table === "extension_events")
      .map((event) => (event.data as { eventId: string }).eventId);
  return {
    boards,
    catalog,
    changeEvents,
    disable: () => {
      enabled = false;
      catalog.invalidate({ projectId: "project-1", reason: "enablement_changed" });
    },
    service,
    state,
    workspace,
  };
};

describe("artifact mount watch service", () => {
  test("runs hooks and notifies views once per burst of direct edits to a watched mount", async () => {
    const harness = createHarness();
    await harness.service.refresh();
    // macOS FSEvents drops changes made right after a stream starts.
    await Bun.sleep(100);

    writeFileSync(join(harness.boards(), "sales.json"), "{}");
    writeFileSync(join(harness.boards(), "ops.json"), "{}");
    mkdirSync(join(harness.boards(), "..", "runs"), { recursive: true });
    writeFileSync(join(harness.boards(), "..", "runs", "run-1.json"), "{}");

    await waitFor(() => harness.state.calls.length > 0);
    await Bun.sleep(1_500);
    expect(harness.state.calls).toEqual([
      expect.objectContaining({
        projectId: "project-1",
        workspaceId: "workspace-1",
        mount: "boards",
        paths: ["ops.json", "sales.json"],
      }),
    ]);
    expect(harness.changeEvents()).toEqual(["artifact.changed:pstdio.dashboards.artifact.boards"]);
    expect(readFileSync(join(harness.boards(), "index.json"), "utf8")).toBe('["ops.json","sales.json"]');
  });

  test("moves watches with the default workspace and closes them when the extension is disabled", async () => {
    const harness = createHarness();
    await harness.service.refresh();
    const firstBoards = harness.boards();

    harness.workspace.root_path = tempDir("pstdio-artifact-watch-moved-");
    await harness.service.refresh();
    await Bun.sleep(100);
    writeFileSync(join(firstBoards, "old.json"), "{}");
    writeFileSync(join(harness.boards(), "new.json"), "{}");
    await waitFor(() => harness.state.calls.length > 0);
    await Bun.sleep(400);
    expect(harness.state.calls.map((call) => call.paths)).toEqual([["new.json"]]);

    harness.disable();
    await harness.service.refresh();
    writeFileSync(join(harness.boards(), "after-disable.json"), "{}");
    await Bun.sleep(1_200);
    expect(harness.state.calls).toHaveLength(1);
  });

  test("does not watch when the default workspace has no local root", async () => {
    const harness = createHarness();
    const localRoot = harness.workspace.root_path;
    harness.workspace.root_path = null;
    await harness.service.refresh();

    mkdirSync(harness.boards(localRoot), { recursive: true });
    writeFileSync(join(harness.boards(localRoot), "x.json"), "{}");
    await Bun.sleep(400);
    expect(harness.changeEvents()).toEqual([]);
  });

  test("does not create the folder of a default workspace that is gone", async () => {
    const harness = createHarness();
    const missingRoot = join(harness.workspace.root_path ?? "", "moved-away");
    harness.workspace.root_path = missingRoot;

    await harness.service.refresh();

    expect(existsSync(missingRoot)).toBe(false);
  });

  test("dispose waits for a running reconcile and starts no watch after it", async () => {
    const projects = Promise.withResolvers<string[]>();
    const harness = createHarness(() => projects.promise);
    let disposed = false;

    const disposing = harness.service.dispose().then(() => {
      disposed = true;
    });
    await Bun.sleep(20);
    expect(disposed).toBe(false);

    projects.resolve(["project-1"]);
    await disposing;
    expect(existsSync(harness.boards())).toBe(false);
  });

  test("dispose waits for hooks that are still handling a change", async () => {
    const harness = createHarness();
    const gate = Promise.withResolvers<void>();
    harness.state.hookGate = gate.promise;
    await harness.service.refresh();
    await Bun.sleep(100);
    writeFileSync(join(harness.boards(), "sales.json"), "{}");
    await waitFor(() => harness.state.calls.length > 0);

    let disposed = false;
    const disposing = harness.service.dispose().then(() => {
      disposed = true;
    });
    await Bun.sleep(20);
    expect(disposed).toBe(false);

    gate.resolve();
    await disposing;
  });
});
