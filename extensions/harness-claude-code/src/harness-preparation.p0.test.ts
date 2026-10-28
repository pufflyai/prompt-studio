import { expect, mock, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createClaudeCodeHarness } from "./harness";

test("reuses a usable global CLI and acquires the pinned package for older or missing commands", async () => {
  let version = "2.1.203";
  let exitCode = 0;
  const probe = mock(async () => ({ exitCode, stdout: version, stderr: "" }));
  const ensure = mock(async () => ({ path: "/cache/pinned" }));
  const ctx = { process: { run: probe }, packages: { ensure } } as unknown as HarnessContext;
  const provider = createClaudeCodeHarness();
  try {
    await provider.prepare?.(ctx);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(ensure).not.toHaveBeenCalled();
    version = "0.0.1";
    await provider.prepare?.(ctx);
    expect(ensure).toHaveBeenLastCalledWith({ name: "@anthropic-ai/claude-code", version: "2.1.203" });
    exitCode = 127;
    await provider.prepare?.(ctx);
    expect(ensure).toHaveBeenCalledTimes(2);
  } finally {
    version = "2.1.203";
    exitCode = 0;
    await provider.prepare?.(ctx);
  }
});
