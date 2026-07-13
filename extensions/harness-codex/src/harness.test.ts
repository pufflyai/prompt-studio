import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createCodexHarness } from "./harness";

const ctx: HarnessContext = {
  extensionId: "pstdio.harness-codex",
  name: "harness-codex",
  process: {
    run: async () => ({ exitCode: 0, stdout: "codex-cli 0.130.0\n", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
};

describe("codex harness detection", () => {
  test("declares discrete run params", () => {
    const harness = createCodexHarness();

    expect(harness.params).toEqual({
      model_reasoning_effort: {
        type: "select",
        label: "Reasoning effort",
        defaultValue: "medium",
        options: [
          { label: "Minimal", value: "minimal", icon: "CircleDot" },
          { label: "Low", value: "low", icon: "Gauge" },
          { label: "Medium", value: "medium", icon: "Brain" },
          { label: "High", value: "high", icon: "Zap" },
          { label: "XHigh", value: "xhigh", icon: "Flame" },
        ],
      },
    });
    expect(harness.params).not.toHaveProperty("approval_policy");
    expect(harness.params).not.toHaveProperty("sandbox_mode");
  });

  test("reports availability with the CLI version", async () => {
    const harness = createCodexHarness();
    expect(await harness.detect!(ctx)).toEqual({ available: true, version: "codex-cli 0.130.0" });
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
  test("normalizes the rollout transcript", async () => {
    const fixture = readFileSync(new URL("./mocks/rollout.jsonl", import.meta.url), "utf8");
    const harness = createCodexHarness({ readTranscript: async () => fixture });

    const messages = await harness.getMessages!(ctx, { agentSessionId: "thread-1" });

    expect(messages[0]).toMatchObject({ role: "user" });
    expect(messages.some((message) => message.parts[0]?.type === "tool")).toBe(true);
  });
});
