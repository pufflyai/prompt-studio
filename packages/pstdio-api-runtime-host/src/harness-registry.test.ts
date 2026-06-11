import { describe, expect, it } from "bun:test";
import type { HarnessSession, HarnessStartInput } from "pstdio-api-contracts";
import type { HarnessContext, HarnessProvider } from "pstdio-api-contracts/extension-kernel";
import type { RuntimeHarnessRecord } from "pstdio-extensions";
import { createHarnessRegistry } from "./harness-registry";

const session = (overrides?: Partial<HarnessSession>): HarnessSession => ({
  done: Promise.resolve({ status: "completed" }),
  stop: () => {},
  ...overrides,
});

const buildContext = (record: RuntimeHarnessRecord, options?: { projectId?: string }): HarnessContext => ({
  projectId: options?.projectId,
  extensionId: record.extensionId,
  name: record.name,
  process: {
    run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({ pid: 1 }),
  },
  net: { findFreePort: async () => 0 },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
});

const record = (overrides?: Partial<HarnessProvider>, id = "fake"): RuntimeHarnessRecord => {
  const provider: HarnessProvider = {
    id,
    label: { $l10n: `harness.${id}`, default: id },
    capabilities: () => ["SessionReattach"],
    start: () => session(),
    resume: () => session(),
    ...overrides,
  };
  return {
    id: `pstdio.pstdio-${id}.${id}`,
    localId: id,
    extensionId: `pstdio.pstdio-${id}`,
    name: `pstdio-${id}`,
    sourcePath: `/fake/pstdio-${id}/extension.ts`,
    provider,
  };
};

const startInput: HarnessStartInput = {
  prompt: "hello",
  sessionId: "session-1",
  events: { push: () => {} },
};

describe("createHarnessRegistry", () => {
  it("resolves handles by namespaced id and lists them", async () => {
    const registry = createHarnessRegistry([record()], buildContext);

    expect(registry.list().map((handle) => handle.id)).toEqual(["pstdio.pstdio-fake.fake"]);
    expect(registry.get("pstdio.pstdio-fake.fake")?.localId).toBe("fake");
    expect(registry.get("fake")).toBeNull();
  });

  it("builds a context carrying the extension identity and project of the call", async () => {
    let seen: HarnessContext | undefined;
    const registry = createHarnessRegistry(
      [
        record({
          start: (ctx) => {
            seen = ctx;
            return session();
          },
        }),
      ],
      buildContext,
    );

    await registry.get("pstdio.pstdio-fake.fake")?.start(startInput, { projectId: "p1" });

    expect(seen?.extensionId).toBe("pstdio.pstdio-fake");
    expect(seen?.projectId).toBe("p1");
  });

  it("defaults detect to available and listModels to empty for providers without them", async () => {
    const registry = createHarnessRegistry([record()], buildContext);
    const handle = registry.get("pstdio.pstdio-fake.fake")!;

    expect(await handle.detect()).toEqual({ available: true });
    expect(await handle.listModels()).toEqual([]);
  });

  it("settles done to failed when a provider's done rejects", async () => {
    const registry = createHarnessRegistry(
      [record({ start: () => session({ done: Promise.reject(new Error("boom")) }) })],
      buildContext,
    );

    const started = await registry.get("pstdio.pstdio-fake.fake")!.start(startInput);

    expect(await started.done).toEqual({ status: "failed" });
  });

  it("settles done to failed when a provider resolves a malformed exit", async () => {
    const registry = createHarnessRegistry(
      [record({ start: () => session({ done: Promise.resolve({} as never) }) })],
      buildContext,
    );

    const started = await registry.get("pstdio.pstdio-fake.fake")!.start(startInput);

    expect(await started.done).toEqual({ status: "failed" });
  });

  it("rejects reattach for providers without it and reports reattach support", async () => {
    const registry = createHarnessRegistry([record()], buildContext);
    const handle = registry.get("pstdio.pstdio-fake.fake")!;

    expect(handle.supportsReattach).toBe(false);
    expect(handle.reattach({ sessionId: "s", agentSessionId: "a", events: { push: () => {} } })).rejects.toThrow(
      "does not support reattach",
    );
  });

  it("keeps the last record and reports duplicates on namespaced id collisions", async () => {
    let started = "";
    const first = record({
      start: () => {
        started = "first";
        return session();
      },
    });
    const second = record({
      start: () => {
        started = "second";
        return session();
      },
    });

    const registry = createHarnessRegistry([first, second], buildContext);
    await registry.get("pstdio.pstdio-fake.fake")!.start(startInput);

    expect(registry.duplicates).toEqual(["pstdio.pstdio-fake.fake"]);
    expect(registry.list()).toHaveLength(1);
    expect(started).toBe("second");
  });
});
