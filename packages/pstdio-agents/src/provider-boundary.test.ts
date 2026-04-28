import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("pstdio-agents provider boundary", () => {
  test("does not export provider-specific harness factories", async () => {
    const agents = await import("./index");

    expect("createClaudeCodeAgent" in agents).toBe(false);
    expect("createOpencodeAgent" in agents).toBe(false);
    expect("createFakeAgent" in agents).toBe(false);
  });

  test("does not own provider-specific implementation directories", () => {
    const providersDir = join(import.meta.dirname, "providers");

    expect(existsSync(join(providersDir, "claude-code"))).toBe(false);
    expect(existsSync(join(providersDir, "opencode"))).toBe(false);
    expect(existsSync(join(providersDir, "fake"))).toBe(false);
  });
});
