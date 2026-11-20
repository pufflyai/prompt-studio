import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createCodexRuntime } from "./codex-runtime";
import { createCodexHarness } from "./harness";
import { nativeItemMessage } from "./native-history";

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
    run: async () => ({ exitCode: 0, stdout: "codex-cli 0.160.1\n", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  state: { get: async () => undefined, set: async () => {}, delete: async () => {} },
};

test("recovers relative image previews from the session directory", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-relative-image-"));
  try {
    writeFileSync(join(root, "preview.png"), Buffer.from("aGVsbG8=", "base64"));
    const runtime = createCodexRuntime();
    runtime.readMessages = async () => [
      {
        ...nativeItemMessage({ type: "imageView", id: "image-1", path: "preview.png" }, "image-turn")!,
        createdAt: undefined,
      },
    ];
    const harness = createCodexHarness({ runtime });
    const messages = await harness.getMessages!(ctx, { agentSessionId: "image-thread", cwd: root });
    expect(messages[0].parts[0]).toMatchObject({
      tool: "view_image",
      state: { output: [{ source: "preview.png", src: "data:image/png;base64,aGVsbG8=" }] },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("codex harness detection", () => {
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

    expect(await harness.detect!(missingCtx)).toMatchObject({ available: false, reason: expect.stringMatching(/\S/) });
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
