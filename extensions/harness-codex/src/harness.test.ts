import { describe, expect, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createCodexRuntime } from "./codex-runtime";
import { createCodexHarness } from "./harness";

const ctx: HarnessContext = {
  extensionId: "pstdio.harness-codex",
  name: "harness-codex",
  connections: {
    request: async () => {
      throw new Error("No connections are configured in this test");
    },
    stream: async function* () {
      yield { type: "end" } as const;
    },
  },
  process: {
    run: async () => ({ exitCode: 0, stdout: "codex-cli 0.159.3\n", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  state: { get: async () => undefined, set: async () => {}, delete: async () => {} },
};

describe("codex harness detection", () => {
  test("declares discrete run params", () => {
    const harness = createCodexHarness();

    expect(harness.params).toMatchObject({
      model_reasoning_effort: {
        type: "select",
        label: "Reasoning effort",
        defaultValue: "medium",
        options: [
          { label: "Minimal", value: "minimal", icon: "level-low" },
          { label: "Low", value: "low", icon: "level-low" },
          { label: "Medium", value: "medium", icon: "level-mid" },
          { label: "High", value: "high", icon: "level-high" },
          { label: "XHigh", value: "xhigh", icon: "level-xhigh" },
        ],
      },
    });
    expect(harness.params).not.toHaveProperty("approval_policy");
    expect(harness.params).not.toHaveProperty("sandbox_mode");
    expect(harness.params?.collaboration_mode).toMatchObject({
      defaultValue: "default",
      options: [
        { label: "Default", value: "default" },
        { label: "Planning", value: "plan" },
      ],
    });
  });

  test("reports availability with the CLI version", async () => {
    const harness = createCodexHarness();
    expect(await harness.detect!(ctx)).toEqual({ available: true, version: "codex-cli 0.159.3" });
  });
  test("refuses a CLI whose live item identities do not survive native history reads", async () => {
    const harness = createCodexHarness();
    const result = await harness.detect!({
      ...ctx,
      process: { ...ctx.process, run: async () => ({ stdout: "codex-cli 0.139.0", stderr: "", exitCode: 0 }) },
    });
    expect(result.available).toBe(false);
  });

  test("reports unavailable when the binary is missing", async () => {
    const harness = createCodexHarness();
    const missingCtx = {
      ...ctx,
      process: {
        ...ctx.process,
        run: async () => {
          throw new Error("spawn codex ENOENT");
        },
      },
    };

    expect(await harness.detect!(missingCtx)).toEqual({ available: false });
  });

  test("lists discovered models only when the CLI is present and caches the catalog", async () => {
    let discoveries = 0;
    const harness = createCodexHarness({
      listModels: async () => {
        discoveries += 1;
        return [{ id: "gpt-live" }];
      },
    });
    expect((await harness.listModels!(ctx)).map((model) => model.id)).toEqual(["gpt-live"]);
    expect((await harness.listModels!(ctx)).map((model) => model.id)).toEqual(["gpt-live"]);
    expect(discoveries).toBe(1);

    const missing = createCodexHarness({ detect: async () => ({ available: false }) });
    expect(await missing.listModels!(ctx)).toEqual([]);
  });
});

describe("codex harness getMessages", () => {
  test("reads native history through the owned runtime", async () => {
    const runtime = createCodexRuntime();
    const messages = [
      { id: "native", createdAt: 1, role: "user" as const, parts: [{ type: "text" as const, text: "hello" }] },
    ];
    runtime.readMessages = async () => messages;
    const harness = createCodexHarness({ runtime });
    expect(await harness.getMessages!(ctx, { agentSessionId: "thread-1" })).toEqual(messages);
  });
});
