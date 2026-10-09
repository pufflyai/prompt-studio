import { expect, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { detectCodex } from "./detection";

const probe = async (stdout: string, stderr = "", exitCode = 0) => {
  const run = async () => ({ stdout, stderr, exitCode });
  const context: HarnessContext = {
    extensionId: "fixture",
    name: "fixture",
    net: { findFreePort: async () => 0 },
    state: { get: async () => undefined, set: async () => {}, delete: async () => {} },
    connections: {
      request: async () => {
        throw new Error("No fixture connection");
      },
      stream: async function* () {
        yield { type: "end" } as const;
      },
    },
    process: { run, runOrThrow: run, spawnDetached: async () => ({ pid: 0 }) },
    logger: { warn: () => {}, info: () => {}, error: () => {} },
  };
  return detectCodex(context);
};

test("accepts the CLI version on stdout or stderr", async () => {
  for (const [stdout, stderr] of [
    ["codex-cli 0.160.1\n", ""],
    ["", "codex-cli 0.160.1\n"],
    ["\u001b[32mcodex-cli 0.160.1\u001b[0m\n", ""],
    ["", "\u001b[32mcodex-cli 0.160.1\u001b[0m\n"],
  ]) {
    expect(await probe(stdout, stderr)).toEqual({ available: true, version: "codex-cli 0.160.1" });
  }
});

for (const output of ["", "login required", "command not found"]) {
  test(`rejects a successful exit without a valid version: ${JSON.stringify(output)}`, async () => {
    expect((await probe(output)).available).toBe(false);
  });
}

test("rejects a failed command even when it prints a version", async () => {
  expect((await probe("codex-cli 0.160.1", "", 1)).available).toBe(false);
});

test("rejects unsupported Codex versions", async () => {
  expect((await probe("codex-cli 0.139.0")).available).toBe(false);
});
