import { expect, mock, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createPiHarness } from "./harness";

test("reuses a usable global CLI and acquires the pinned package for older or missing commands", async () => {
  let version = "0.73.1";
  let exitCode = 0;
  const probe = mock(async () => ({ exitCode, stdout: version, stderr: "" }));
  const ensure = mock(async () => ({ path: "/cache/pinned" }));
  const ctx = { process: { run: probe }, packages: { ensure } } as unknown as HarnessContext;
  const provider = createPiHarness();
  try {
    await provider.prepare?.(ctx);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(ensure).not.toHaveBeenCalled();
    version = "0.0.1";
    await provider.prepare?.(ctx);
    expect(ensure).toHaveBeenLastCalledWith({ name: "@mariozechner/pi-coding-agent", version: "0.73.1" });
    exitCode = 127;
    await provider.prepare?.(ctx);
    expect(ensure).toHaveBeenCalledTimes(2);
  } finally {
    version = "0.73.1";
    exitCode = 0;
    await provider.prepare?.(ctx);
  }
});
