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
  events: { push: () => {}, getMessages: () => [] },
};

describe("harness detection isolation", () => {
  it("rejects a retired harness after preparation has already completed", async () => {
    const detect = mock(() => ({ available: true }));
    const registry = createHarnessRegistry([record({ prepare: async () => {}, detect })], buildContext);
    const harness = registry.list()[0]!;
    expect((await harness.detect()).available).toBe(true);
    const pending = harness.detect();
    const closing = registry.dispose();
    await expect(pending).rejects.toThrow("disposed");
    await closing;
    expect(detect).toHaveBeenCalledTimes(1);
  });
  it("finishes preparation before disposing provider resources", async () => {
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const events: string[] = [];
    const registry = createHarnessRegistry(
      [
        record({
          prepare: async () => {
            started.resolve();
            await release.promise;
            events.push("allocated");
          },
          dispose: () => {
            events.push("disposed");
          },
        }),
      ],
      buildContext,
    );
    const detection = registry.list()[0]!.detect();
    void detection.catch(() => {});
    await started.promise;
    const closing = registry.dispose();
    await Bun.sleep(0);
    expect(events).toEqual([]);
    release.resolve();
    await closing;
    await expect(detection).rejects.toThrow("disposed");
    expect(events).toEqual(["allocated", "disposed"]);
  });
  it("prepares a harness once before operations and retries a failed preparation", async () => {
    let attempts = 0;
    const gate = Promise.withResolvers<void>();
    const ready: string[] = [];
    const registry = createHarnessRegistry(
      [
        record({
          prepare: async () => {
            if (++attempts === 1) throw new Error("Download failed");
            await gate.promise;
            ready.push("prepared");
          },
          detect: () => {
            ready.push("detected");
            return { available: true };
          },
        }),
      ],
      buildContext,
    );
    const harness = registry.list()[0]!;
    await harness.capabilities();
    expect(attempts).toBe(0);
    expect((await harness.detect()).available).toBe(false);
    const detection = harness.detect();
    const capabilities = harness.capabilities();
    await Bun.sleep(0);
    expect(ready).toEqual([]);
    gate.resolve();
    await Promise.all([detection, capabilities]);
    expect(ready).toEqual(["prepared", "detected"]);
    expect(attempts).toBe(2);
    await registry.dispose();
  });
  it("isolates a throwing detection provider from healthy harnesses", async () => {
    const registry = createHarnessRegistry(
      [
        record(
          {
            detect: () => {
              throw new Error("broken provider");
            },
          },
          "broken",
        ),
        record({ detect: () => ({ available: true }) }, "healthy"),
      ],
      buildContext,
    );
    expect(await Promise.all(registry.list().map((handle) => handle.detect()))).toEqual([
      { available: false, reason: expect.stringMatching(/\S/) },
      { available: true },
    ]);
  });

  it("bounds a provider that never completes its detection", async () => {
    const registry = createHarnessRegistry(
      [
        record({ detect: () => new Promise(() => {}) }, "hanging"),
        record({ detect: () => ({ available: true }) }, "healthy"),
      ],
      buildContext,
    );
    expect(await Promise.all(registry.list().map((handle) => handle.detect()))).toEqual([
      { available: false, reason: expect.stringMatching(/\S/) },
      { available: true },
    ]);
  });

  it("keeps the reason a provider gives for being unavailable", async () => {
    const detection = { available: false, version: "0.1.0", reason: "The CLI is too old." };
    const registry = createHarnessRegistry([record({ detect: () => detection })], buildContext);
    expect(await registry.list()[0].detect()).toEqual(detection);
  });
});

describe("createHarnessRegistry", () => {
  it("requires provider recovery before exposing native history", () => {
    expect(() => createHarnessRegistry([record({ getMessages: () => [] })], buildContext)).toThrow("recoverMessages");
    const recovery = mock(
      (_ctx: HarnessContext, input: { knownMessages: readonly import("pstdio-api-contracts").SessionMessage[] }) => ({
        kind: "recovered" as const,
        messages: [...input.knownMessages],
      }),
    );
    const registry = createHarnessRegistry(
      [record({ getMessages: () => [], recoverMessages: recovery })],
      buildContext,
    );
    expect(registry.list()[0].supportsHistory).toBe(true);
  });
  it("resolves handles by namespaced id and lists them", async () => {
    const registry = createHarnessRegistry([record()], buildContext);

    expect(registry.list().map((handle) => handle.id)).toEqual(["pstdio.pstdio-fake.harness.fake"]);
    expect(registry.get("pstdio.pstdio-fake.harness.fake")?.localId).toBe("fake");
    expect(registry.get("pstdio.pstdio-fake.harness.fake")?.cwdRequirement).toBe("required");
    expect(registry.get("fake")).toBeNull();
  });

  it("preserves an optional cwd requirement", () => {
    const registry = createHarnessRegistry([record({ cwdRequirement: "optional" })], buildContext);

    expect(registry.get("pstdio.pstdio-fake.harness.fake")?.cwdRequirement).toBe("optional");
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
    expect(
      handle.reattach({ sessionId: "s", agentSessionId: "a", events: { push: () => {}, getMessages: () => [] } }),
    ).rejects.toThrow("does not support reattach");
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

it("retirement rejects account startup while its awaited context is being delivered", async () => {
  const authenticate = mock(async () => {});
  const source = record({ authenticate });
  const context = Promise.withResolvers<HarnessContext>();
  const registry = createHarnessRegistry([source], () => context.promise);
  const handle = registry.get(source.id)!;
  const result = handle.authenticate!(
    { action: "login" },
    { signal: new AbortController().signal, emit: async () => {}, request: async () => "" },
  ).then(
    () => "started",
    () => "retired",
  );
  const closing = Promise.withResolvers<void>();
  context.resolve(buildContext(source));
  queueMicrotask(() => {
    void handle.dispose().then(closing.resolve, closing.reject);
  });
  await closing.promise;
  expect(await result).toBe("retired");
  expect(authenticate).not.toHaveBeenCalled();
  await registry.dispose();
});
