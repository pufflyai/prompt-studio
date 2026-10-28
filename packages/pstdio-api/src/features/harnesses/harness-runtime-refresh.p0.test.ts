import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createProjectExtensionRuntimeCatalog } from "../extensions/project-extension-runtime-catalog";
import { createHarnessRegistryService } from "./harness-registry-service";

let root: string;
let previousPstdioHome: string | undefined;
const released: string[] = [];
(globalThis as { __harnessRefreshReleased?: string[] }).__harnessRefreshReleased = released;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "pstdio-harness-refresh-"));
  previousPstdioHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "pstdio-home");
  released.length = 0;
});

afterEach(() => {
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;
  rmSync(root, { recursive: true, force: true });
});

const writeHarnessExtension = (path: string, label: string) => {
  mkdirSync(path, { recursive: true });
  writeFileSync(
    join(path, "package.json"),
    JSON.stringify({
      name: "worker",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(path, "extension.ts"),
    `const run = () => ({ done: Promise.resolve({ status: "completed" }), stop: () => {} });
export default {
  harnesses: [{
    id: "worker",
    ref: { kind: "harness", id: "worker" },
    label: ${JSON.stringify(label)},
    capabilities: () => [],
    detect: () => ({ available: true }),
    listModels: () => [],
    start: run,
    resume: run,
    dispose: (ctx) => void globalThis.__harnessRefreshReleased.push(ctx.projectId),
  }],
};`,
  );
};

const createRegistry = (sourcePath: string) => {
  const catalog = createProjectExtensionRuntimeCatalog({
    extensionService: {
      listEnabledSourcesForProject: async () => [
        {
          instance: { id: "worker-instance", namespace: "worker", enabled: true },
          installedSource: {
            id: "worker-source",
            extension_id: "pstdio.worker",
            source_kind: "local_path",
            source_path: sourcePath,
            status: "loaded",
          },
        },
      ],
    } as never,
    projectService: { get: async (id: string) => ({ id, name: "Project", shorthand: "PS" }) } as never,
    workspaceService: { getDefault: async () => null } as never,
  });
  const registry = createHarnessRegistryService({
    installedExtensionSourcesService: { list: async () => [] } as never,
    extensionRuntimeCatalog: catalog,
  });
  return { catalog, registry };
};

const workerId = "pstdio.worker.harness.worker";

test("a full extension runtime refresh keeps workers of unchanged harness sources running", async () => {
  const sourcePath = join(root, "worker");
  writeHarnessExtension(sourcePath, "Worker");
  const { catalog, registry } = createRegistry(sourcePath);
  try {
    const running = (await registry.get(workerId, { projectId: "p1" }))!;
    await running.capabilities({ projectId: "p1" });

    catalog.invalidate({ reason: "runtime_refresh" });
    catalog.invalidate({ reason: "webviews_built" });
    const current = await registry.get(workerId, { projectId: "p1" });

    expect(released).toEqual([]);
    expect(current?.id).toBe(workerId);
    await running.capabilities({ projectId: "p1" });
  } finally {
    await registry.dispose();
  }
});

// Reloading an extension or re-registering its row reports a source change even when no file changed.
test("a source change event keeps workers of an unchanged harness source running", async () => {
  const sourcePath = join(root, "worker");
  writeHarnessExtension(sourcePath, "Worker");
  const { catalog, registry } = createRegistry(sourcePath);
  try {
    const running = (await registry.get(workerId, { projectId: "p1" }))!;
    await running.capabilities({ projectId: "p1" });

    catalog.invalidate({ sourcePath, reason: "source_changed" });
    await registry.get(workerId, { projectId: "p1" });

    expect(released).toEqual([]);
    await running.capabilities({ projectId: "p1" });
  } finally {
    await registry.dispose();
  }
});

test("a source change event replaces workers of an edited harness source", async () => {
  const sourcePath = join(root, "worker");
  writeHarnessExtension(sourcePath, "Worker");
  const { catalog, registry } = createRegistry(sourcePath);
  try {
    const running = (await registry.get(workerId, { projectId: "p1" }))!;
    await running.capabilities({ projectId: "p1" });

    writeHarnessExtension(sourcePath, "Edited worker");
    catalog.invalidate({ sourcePath, reason: "source_changed" });
    await registry.get(workerId, { projectId: "p1" });

    expect(released).toEqual(["p1"]);
  } finally {
    await registry.dispose();
  }
});

test("a full extension runtime refresh replaces workers of edited harness sources", async () => {
  const sourcePath = join(root, "worker");
  writeHarnessExtension(sourcePath, "Worker");
  const { catalog, registry } = createRegistry(sourcePath);
  try {
    const running = (await registry.get(workerId, { projectId: "p1" }))!;
    await running.capabilities({ projectId: "p1" });

    writeHarnessExtension(sourcePath, "Edited worker");
    catalog.invalidate({ reason: "runtime_refresh" });
    await registry.get(workerId, { projectId: "p1" });

    expect(released).toEqual(["p1"]);
  } finally {
    await registry.dispose();
  }
});
