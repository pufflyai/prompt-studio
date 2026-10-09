import { expect, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { detectClaude } from "./detection";

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
  return detectClaude(context);
};

test("accepts the CLI version on stdout or stderr", async () => {
  for (const [stdout, stderr] of [
    ["2.1.295 (Claude Code)\n", ""],
    ["", "2.1.295 (Claude Code)\n"],
    ["\u001b[32m2.1.295 (Claude Code)\u001b[0m\n", ""],
    ["", "\u001b[32m2.1.295 (Claude Code)\u001b[0m\n"],
  ]) {
    expect(await probe(stdout, stderr)).toEqual({ available: true, version: "2.1.295 (Claude Code)" });
  }
});

for (const output of ["", "login required", "command not found"]) {
  test(`rejects a successful exit without a valid version: ${JSON.stringify(output)}`, async () => {
    expect(await probe(output)).toEqual({ available: false, reason: expect.stringMatching(/\S/) });
  });
}

test("rejects a failed command even when it prints a version", async () => {
  expect(await probe("2.1.295 (Claude Code)", "", 1)).toEqual({
    available: false,
    reason: expect.stringMatching(/\S/),
  });
});

test("accepts Claude Code 2.1.203 and every newer release", async () => {
  for (const version of [
    "2.1.203 (Claude Code)",
    "2.1.295 (Claude Code)",
    "2.2.0 (Claude Code)",
    "3.0.0 (Claude Code)",
  ]) {
    expect(await probe(version)).toEqual({ available: true, version });
  }
});

test("rejects Claude Code releases older than 2.1.203 and names both versions", async () => {
  const result = await probe("2.1.202 (Claude Code)");
  // The reason names the version found and the version required.
  expect(result).toMatchObject({
    available: false,
    version: "2.1.202 (Claude Code)",
    reason: expect.stringMatching(/^(?=.*2\.1\.202)(?=.*2\.1\.203)/),
  });
});
