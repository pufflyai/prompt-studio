import { expect, mock, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./harness";

test("reuses a usable global CLI and acquires the pinned package for older or missing commands", async () => {
  let version = "1.0.175";
  let exitCode = 0;
  const probe = mock(async () => ({ exitCode, stdout: version, stderr: "" }));
  const ensure = mock(async () => ({ path: "/cache/pinned" }));
  const ctx = { process: { run: probe }, packages: { ensure } } as unknown as HarnessContext;
  const provider = createOpencodeHarness();
  try {
    await provider.prepare?.(ctx);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(ensure).not.toHaveBeenCalled();
    version = "0.0.1";
    await provider.prepare?.(ctx);
    expect(ensure).toHaveBeenLastCalledWith({ name: "opencode-ai", version: "1.18.34" });
    exitCode = 127;
    await provider.prepare?.(ctx);
    expect(ensure).toHaveBeenCalledTimes(2);
  } finally {
    version = "1.0.175";
    exitCode = 0;
    await provider.prepare?.(ctx);
  }
});
