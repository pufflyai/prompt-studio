import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { detectCodex } from "./detection";
import { resolveManagedCodex } from "./managed-cli";

for (const platform of ["darwin", "linux", "win32"] as const) {
  for (const arch of ["x64", "arm64"]) {
    test(`resolves the private native CLI for ${platform} ${arch}`, () => {
      const command = resolveManagedCodex({
        platform,
        arch,
        resolvePackage: (name) => join("/packages", name, "package.json"),
        exists: () => true,
      });
      expect(command).not.toBeNull();
      expect(command).toEndWith(platform === "win32" ? "codex.exe" : "codex");
    });
  }
}

test("reports a missing native dependency without invoking an installer", () => {
  expect(
    resolveManagedCodex({
      resolvePackage: () => {
        throw new Error("Not installed");
      },
    }),
  ).toBeNull();
});

test("detects the installed private CLI without PATH tools", async () => {
  const home = mkdtempSync(join(tmpdir(), "private-codex-"));
  const before = { ...process.env };
  process.env.PATH = "";
  process.env.HOME = home;
  process.env.CODEX_HOME = home;
  const context = {
    process: {
      run: async (input: Parameters<HarnessContext["process"]["run"]>[0]) => {
        const result = Bun.spawnSync(input.command, { timeout: input.timeoutMs });
        return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
      },
    },
    logger: { warn() {} },
  } as unknown as HarnessContext;
  try {
    const result = await detectCodex(context);
    expect(result).toMatchObject({ available: true });
  } finally {
    for (const key of ["PATH", "HOME", "CODEX_HOME"]) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
    rmSync(home, { recursive: true, force: true });
  }
});
