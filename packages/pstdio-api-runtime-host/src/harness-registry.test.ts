import { describe, expect, it, mock } from "bun:test";
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
    ref: { kind: "harness", id },
    label: { $l10n: `harness.${id}`, default: id },
    capabilities: () => ["SessionReattach"],
    start: () => session(),
    resume: () => session(),
    ...overrides,
  };
  return {
    id: `pstdio.pstdio-${id}.harness.${id}`,
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

    expect(registry.list().map((handle) => handle.id)).toEqual(["pstdio.pstdio-fake.harness.fake"]);
    expect(registry.get("pstdio.pstdio-fake.harness.fake")?.localId).toBe("fake");
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

    await registry.get("pstdio.pstdio-fake.harness.fake")?.start(startInput, { projectId: "p1" });

    expect(seen?.extensionId).toBe("pstdio.pstdio-fake");
    expect(seen?.projectId).toBe("p1");
  });

  it("defaults detect to available and listModels to empty for providers without them", async () => {
    const registry = createHarnessRegistry([record()], buildContext);
    const handle = registry.get("pstdio.pstdio-fake.harness.fake")!;

    expect(await handle.detect()).toEqual({ available: true });
    expect(await handle.listModels()).toEqual([]);
  });

  it("settles done to failed when a provider's done rejects", async () => {
    const registry = createHarnessRegistry(
      [record({ start: () => session({ done: Promise.reject(new Error("boom")) }) })],
      buildContext,
    );

    const started = await registry.get("pstdio.pstdio-fake.harness.fake")!.start(startInput);

    expect(await started.done).toEqual({ status: "failed" });
  });

  it("settles done to failed when a provider resolves a malformed exit", async () => {
    const registry = createHarnessRegistry(
      [record({ start: () => session({ done: Promise.resolve({} as never) }) })],
      buildContext,
    );

    const started = await registry.get("pstdio.pstdio-fake.harness.fake")!.start(startInput);

    expect(await started.done).toEqual({ status: "failed" });
  });

  it("rejects reattach for providers without it and reports reattach support", async () => {
    const registry = createHarnessRegistry([record()], buildContext);
    const handle = registry.get("pstdio.pstdio-fake.harness.fake")!;

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
    await registry.get("pstdio.pstdio-fake.harness.fake")!.start(startInput);

    expect(registry.duplicates).toEqual(["pstdio.pstdio-fake.harness.fake"]);
    expect(registry.list()).toHaveLength(1);
    expect(started).toBe("second");
  });

  it("exposes harness params and forwards valid params to start", async () => {
    const start = mock((_ctx: HarnessContext, _input: HarnessStartInput) => session());
    const params = {
      effort: {
        type: "select" as const,
        defaultValue: "low",
        options: [
          { label: "Low", value: "low" },
          { label: "High", value: "high" },
        ],
      },
      dryRun: { type: "boolean" as const, defaultValue: false },
    };
    const registry = createHarnessRegistry([record({ params, start })], buildContext);
    const handle = registry.get("pstdio.pstdio-fake.harness.fake")!;

    expect(handle.params).toEqual(params);

    await handle.start({ ...startInput, params: { effort: "high", dryRun: true } });

    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0]?.[1].params).toEqual({ effort: "high", dryRun: true });
  });

  it("rejects invalid harness params before invoking start", async () => {
    const start = mock((_ctx: HarnessContext, _input: HarnessStartInput) => session());
    const registry = createHarnessRegistry(
      [
        record({
          params: {
            effort: {
              type: "select" as const,
              options: [
                { label: "Low", value: "low" },
                { label: "High", value: "high" },
              ],
            },
          },
          start,
        }),
      ],
      buildContext,
    );

    await expect(
      registry.get("pstdio.pstdio-fake.harness.fake")!.start({ ...startInput, params: { effort: "medium" } }),
    ).rejects.toThrow('Harness param "effort"');
    expect(start).not.toHaveBeenCalled();
  });

  it("validates params against the selected model metadata", async () => {
    const start = mock((_ctx: HarnessContext, _input: HarnessStartInput) => session());
    const registry = createHarnessRegistry(
      [
        record({
          params: {
            effort: {
              type: "select" as const,
              options: [
                { label: "Low", value: "low" },
                { label: "High", value: "high" },
              ],
            },
          },
          listModels: () => [
            { id: "small", paramOverrides: { effort: null } },
            {
              id: "large",
              paramOverrides: {
                effort: {
                  type: "select" as const,
                  options: [{ label: "High", value: "high" }],
                },
              },
            },
          ],
          start,
        }),
      ],
      buildContext,
    );
    const handle = registry.get("pstdio.pstdio-fake.harness.fake")!;

    await expect(handle.start({ ...startInput, model: "small", params: { effort: "low" } })).rejects.toThrow(
      'Harness param "effort" is not declared.',
    );
    await expect(handle.start({ ...startInput, model: "large", params: { effort: "low" } })).rejects.toThrow(
      'Harness param "effort"',
    );
    await handle.start({ ...startInput, model: "large", params: { effort: "high" } });

    expect(start).toHaveBeenCalledTimes(1);
  });

  it("rejects missing required harness params before invoking start", async () => {
    const start = mock((_ctx: HarnessContext, _input: HarnessStartInput) => session());
    const registry = createHarnessRegistry(
      [
        record({
          params: {
            mode: {
              type: "select" as const,
              required: true,
              options: [
                { label: "Agent", value: "agent" },
                { label: "Plan", value: "plan" },
              ],
            },
          },
          start,
        }),
      ],
      buildContext,
    );

    await expect(registry.get("pstdio.pstdio-fake.harness.fake")!.start({ ...startInput, params: {} })).rejects.toThrow(
      'Harness param "mode" is required.',
    );
    expect(start).not.toHaveBeenCalled();
  });
});

describe("harness skills layout", () => {
  it("normalizes a declared skills layout, defaulting globalDir to dir", () => {
    const registry = createHarnessRegistry([record({ skills: { dir: ".claude/skills" } })], buildContext);

    expect(registry.get("pstdio.pstdio-fake.harness.fake")?.skills).toEqual({
      dir: ".claude/skills",
      globalDir: ".claude/skills",
    });
  });

  it("keeps a distinct globalDir", () => {
    const registry = createHarnessRegistry(
      [record({ skills: { dir: ".agents/skills", globalDir: ".config/agents/skills" } })],
      buildContext,
    );

    expect(registry.get("pstdio.pstdio-fake.harness.fake")?.skills).toEqual({
      dir: ".agents/skills",
      globalDir: ".config/agents/skills",
    });
  });

  it("exposes null skills when the provider declares none or an empty dir", () => {
    const registry = createHarnessRegistry([record(), record({ skills: { dir: "" } }, "other")], buildContext);

    expect(registry.get("pstdio.pstdio-fake.harness.fake")?.skills).toBeNull();
    expect(registry.get("pstdio.pstdio-other.harness.other")?.skills).toBeNull();
  });
});
