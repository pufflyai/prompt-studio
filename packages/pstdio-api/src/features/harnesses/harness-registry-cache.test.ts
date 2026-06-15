import { describe, expect, test } from "bun:test";
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
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  }));

type EnabledRow = { installedSource: { source_path: string; source_kind: "local_path" } };

const makeService = (opts: {
  enabled: () => EnabledRow[];
  build: (input: { paths: Map<string, string>; options?: { projectId?: string } }) => Promise<HarnessRegistry>;
  now?: () => number;
  detectCacheTtlMs?: number;
}) =>
  createHarnessRegistryService({
    installedExtensionSourcesService: { list: async () => [] } as never,
    extensionService: { listEnabledSourcesForProject: async () => opts.enabled() } as never,
    buildRegistry: opts.build as never,
    now: opts.now,
    detectCacheTtlMs: opts.detectCacheTtlMs,
  });

const SCOPE = { projectId: "p1" };
const FAKE_ID = testHarnessId("fake");
const oneSource = (): EnabledRow[] => [{ installedSource: { source_path: "/ext/a", source_kind: "local_path" } }];

describe("harness registry caching", () => {
  test("reuses the built registry while the enabled source set is unchanged", async () => {
    let builds = 0;
    const service = makeService({
      enabled: oneSource,
      build: async () => {
        builds += 1;
        return buildFakeRegistry([createTestHarnessRecord("fake")]);
      },
    });

    await service.list(SCOPE);
    await service.get(FAKE_ID, SCOPE);
    await service.list(SCOPE);

    expect(builds).toBe(1);
  });

  test("rebuilds when the enabled source set changes (install/enable)", async () => {
    let builds = 0;
    let enabled = oneSource();
    const service = makeService({
      enabled: () => enabled,
      build: async () => {
        builds += 1;
        return buildFakeRegistry([createTestHarnessRecord("fake")]);
      },
    });

    await service.list(SCOPE);
    enabled = [...enabled, { installedSource: { source_path: "/ext/b", source_kind: "local_path" } }];
    await service.list(SCOPE);

    expect(builds).toBe(2);
  });

  test("invalidate() forces a rebuild on the next call (in-place source reload)", async () => {
    let builds = 0;
    const service = makeService({
      enabled: oneSource,
      build: async () => {
        builds += 1;
        return buildFakeRegistry([createTestHarnessRecord("fake")]);
      },
    });

    await service.list(SCOPE);
    service.invalidate();
    await service.list(SCOPE);

    expect(builds).toBe(2);
  });

  test("memoizes detect() within the TTL window, re-detecting after it expires", async () => {
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
    const service = makeService({
      enabled: oneSource,
      build: async () => buildFakeRegistry([record]),
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
