import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionConnectionRequest, ExtensionConnectionsApi } from "pstdio-api-contracts/extension-kernel";
import type { HarnessRegistry } from "pstdio-api-runtime-host";
import { createHarnessRegistry } from "pstdio-api-runtime-host";
import type { RuntimeHarnessRecord } from "pstdio-extensions";
import { createHarnessRegistryService } from "./harness-registry-service";
import { createTestHarnessRecord, testHarnessId } from "./test-harness-registry";

// A raw registry whose context never shells out — the caching tests only care
// about identity and detect() call counts, not real harness behavior.
const buildFakeRegistry = (records: RuntimeHarnessRecord[]): HarnessRegistry =>
  createHarnessRegistry(records, (record, options) => ({
    projectId: options?.projectId,
    extensionId: record.extensionId,
    name: record.name,
    process: {
      run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      spawnDetached: async () => ({}),
    },
    net: { findFreePort: async () => 0 },
    connections: {
      request: async () => {
        throw new Error("No test connection configured.");
      },
      stream: async function* () {
        yield await Promise.reject(new Error("No test connection configured."));
      },
    },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    state: { get: async () => undefined, set: async () => {}, delete: async () => {} },
  }));

type SourceRow = { source_path: string; source_kind: "local_path" };

const fakeSnapshot = (generation: number, records: RuntimeHarnessRecord[]) =>
  ({
    generation,
    project: { id: "p1", name: "Project", shorthand: "PS" },
    enabledSources: [],
    runtime: { harnesses: records },
    stale: null,
  }) as never;

const registeredSource = (name: string): SourceRow => {
  const path = join(tempHome, name);
  mkdirSync(path, { recursive: true });
  return { source_path: path, source_kind: "local_path" };
};

const makeService = (opts: {
  installedSources?: () => SourceRow[];
  snapshot?: () => ReturnType<typeof fakeSnapshot>;
  build?: (input: { paths: Map<string, string> }) => Promise<HarnessRegistry>;
  now?: () => number;
  detectCacheTtlMs?: number;
  createConnectionsApi?: Parameters<typeof createHarnessRegistryService>[0]["createConnectionsApi"];
}) =>
  createHarnessRegistryService({
    installedExtensionSourcesService: { list: async () => opts.installedSources?.() ?? [] } as never,
    extensionRuntimeCatalog: { get: async () => opts.snapshot?.() ?? fakeSnapshot(1, []) } as never,
    buildRegistry: opts.build as never,
    installDefaultExtensions: (async () => {}) as never,
    now: opts.now,
    detectCacheTtlMs: opts.detectCacheTtlMs,
    createConnectionsApi: opts.createConnectionsApi,
  });

const SCOPE = { projectId: "p1" };
const FAKE_ID = testHarnessId("fake");

let previousPstdioHome: string | undefined;
let tempHome: string;

beforeEach(() => {
  // Point the host scan at an empty home so only the fake DB rows drive the path set.
  previousPstdioHome = process.env.PSTDIO_HOME;
  tempHome = mkdtempSync(join(tmpdir(), "pstdio-harness-cache-home-"));
  process.env.PSTDIO_HOME = tempHome;
});

afterEach(() => {
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;
  rmSync(tempHome, { recursive: true, force: true });
});

describe("harness registry host-scope caching", () => {
  test("reuses the built registry while the registered source set is unchanged", async () => {
    let builds = 0;
    const service = makeService({
      installedSources: () => [registeredSource("ext-a")],
      build: async () => {
        builds += 1;
        return buildFakeRegistry([createTestHarnessRecord("fake")]);
      },
    });

    await service.list();
    await service.get(FAKE_ID);
    await service.list();

    expect(builds).toBe(1);
  });

  test("rebuilds when the registered source set changes (install/uninstall)", async () => {
    let builds = 0;
    let sources: SourceRow[] = [registeredSource("ext-a")];
    const service = makeService({
      installedSources: () => sources,
      build: async () => {
        builds += 1;
        return buildFakeRegistry([createTestHarnessRecord("fake")]);
      },
    });

    await service.list();
    sources = [...sources, registeredSource("ext-b")];
    await service.list();

    expect(builds).toBe(2);
  });

  test("invalidate() forces a rebuild on the next call (in-place source reload)", async () => {
    let builds = 0;
    const service = makeService({
      installedSources: () => [registeredSource("ext-a")],
      build: async () => {
        builds += 1;
        return buildFakeRegistry([createTestHarnessRecord("fake")]);
      },
    });

    await service.list();
    service.invalidate();
    await service.list();

    expect(builds).toBe(2);
  });
});

describe("harness registry project scope", () => {
  test("gives a project harness only its host-managed connection client", async () => {
    const request = mock(async (_connectionId: string, _input: ExtensionConnectionRequest) => ({
      status: 200,
      headers: {},
      body: { id: "remote-1" },
    }));
    const start = mock(async (ctx: { connections: ExtensionConnectionsApi }) => {
      await ctx.connections.request("control-plane", { method: "POST", path: "/v1/workspaces" });
      return { done: Promise.resolve({ status: "completed" as const }), stop: () => {} };
    });
    const service = makeService({
      snapshot: () => fakeSnapshot(1, [createTestHarnessRecord("remote", { provider: { start } as never })]),
      createConnectionsApi: () => ({
        request: request as unknown as ExtensionConnectionsApi["request"],
        stream: async function* () {
          yield { type: "end" as const };
        },
      }),
    });

    const harness = await service.get(testHarnessId("remote"), SCOPE);
    await harness?.start({ prompt: "run", sessionId: "session-1", events: { push: () => {} } }, SCOPE);

    expect(request).toHaveBeenCalledWith("control-plane", {
      method: "POST",
      path: "/v1/workspaces",
    });
  });

  test("builds handles from the project's runtime snapshot", async () => {
    const service = makeService({
      snapshot: () => fakeSnapshot(1, [createTestHarnessRecord("fake")]),
    });

    const handles = await service.list(SCOPE);

    expect(handles.map((handle) => handle.id)).toEqual([FAKE_ID]);
  });

  test("a new snapshot generation rebuilds the project handles", async () => {
    let snapshot = fakeSnapshot(1, [createTestHarnessRecord("fake")]);
    const service = makeService({ snapshot: () => snapshot });

    expect((await service.list(SCOPE)).map((handle) => handle.id)).toEqual([FAKE_ID]);

    snapshot = fakeSnapshot(2, [createTestHarnessRecord("fake"), createTestHarnessRecord("other")]);
    expect((await service.list(SCOPE)).map((handle) => handle.id)).toEqual([FAKE_ID, testHarnessId("other")]);
  });

  test("memoizes detect() within the TTL window while the snapshot is unchanged", async () => {
    let detects = 0;
    let clock = 0;
    const record = createTestHarnessRecord("fake", {
      provider: {
        detect: () => {
          detects += 1;
          return { available: true };
        },
      },
    });
    const snapshot = fakeSnapshot(1, [record]);
    const service = makeService({
      snapshot: () => snapshot,
      now: () => clock,
      detectCacheTtlMs: 1000,
    });

    const handle = await service.get(FAKE_ID, SCOPE);
    await handle?.detect();
    await handle?.detect();
    expect(detects).toBe(1);

    clock += 1001;
    await handle?.detect();
    expect(detects).toBe(2);
  });
});
