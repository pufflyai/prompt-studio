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

  test("lists known models only when the CLI is present", async () => {
    const harness = createCodexHarness();
    expect((await harness.listModels!(ctx)).map((model) => model.id)).toEqual(["gpt-5.5", "gpt-5.3-codex"]);

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
