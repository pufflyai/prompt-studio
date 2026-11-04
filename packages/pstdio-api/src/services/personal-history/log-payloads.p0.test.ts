import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSessionLogFiles } from "./log-files";

test("personal generic log payloads persist as immutable files outside SQL entry pointers", async () => {
  const root = await mkdtemp(join(tmpdir(), "personal-payloads-"));
  try {
    const files = createSessionLogFiles(root);
    const payloads = files.payloads("account", "session");
    const value = { output: "private large history".repeat(250_000) };
    const pointer = await payloads.encode(value);
    expect(pointer.byteLength).toBeLessThan(100);
    expect(await createSessionLogFiles(root).payloads("account", "session").decode(pointer)).toEqual(value);
    expect(await files.readPosition("account", "session")).toEqual({ after: 0 });
    await expect(payloads.decode(new TextEncoder().encode("../../another-account"))).rejects.toThrow("pointer");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
