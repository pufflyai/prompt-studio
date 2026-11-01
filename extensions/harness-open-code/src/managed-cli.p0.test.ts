import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { resolveManagedOpencode, resolveOpencodeCommand } from "./cli";
import { detectOpencode } from "./detection";

for (const platform of ["darwin", "linux", "win32"] as const) {
  for (const arch of ["x64", "arm64"]) {
    test(`resolves the private native CLI for ${platform} ${arch}`, () => {
      const command = resolveManagedOpencode({
        platform,
        arch,
        resolvePackage: (name) => join("/packages", name, "package.json"),
        exists: () => true,
      });
      expect(command).not.toBeNull();
      expect(command).toEndWith(platform === "win32" ? "opencode.exe" : "opencode");
    });
  }
}

test("reports a missing native dependency without invoking an installer", () => {
  expect(
    resolveManagedOpencode({
      resolvePackage: () => {
        throw new Error("Not installed");
      },
    }),
  ).toBeNull();
});

test("detects the installed private CLI without PATH tools", async () => {
  const home = mkdtempSync(join(tmpdir(), "private-opencode-"));
  const before = { ...process.env };
  process.env.PATH = "";
  process.env.HOME = home;
  process.env.CODEX_HOME = home;
  const context = {
    process: {
      run: async (input: Parameters<HarnessContext["process"]["run"]>[0]) => {
        const child = Bun.spawn(input.command, {
          env: { ...process.env, ...input.env },
          timeout: input.timeoutMs,
          stdout: "pipe",
          stderr: "pipe",
        });
        const [exitCode, stdout, stderr] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ]);
        return { exitCode, stdout, stderr };
      },
    },
    logger: { warn() {} },
  } as unknown as HarnessContext;
  try {
    const result = await detectOpencode(context);
    expect(result).toMatchObject({ available: true });
  } finally {
    for (const key of ["PATH", "HOME", "CODEX_HOME"]) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
    rmSync(home, { recursive: true, force: true });
  }
});

test("prefers an existing CLI and otherwise uses the managed CLI", () => {
  expect(resolveOpencodeCommand({ which: () => "/tools/cli", managed: () => "/private/cli" })).toBe("/tools/cli");
  expect(resolveOpencodeCommand({ which: () => null, managed: () => "/private/cli" })).toBe("/private/cli");
});

test("uses a native executable for interactive sign-in through a Windows npm shim", () => {
  const native = "C:\\npm\\native.exe";
  expect(
    resolveOpencodeCommand({
      platform: "win32",
      which: () => "C:\\npm\\cli.cmd",
      exists: () => false,
      managed: () => native,
    }),
  ).toBe(native);
});

test("native resolution outside Linux skips diagnostic reports", () => {
  const previous = process.report!.getReport;
  process.report!.getReport = () => {
    throw new Error("Report unavailable");
  };
  try {
    expect(
      resolveManagedOpencode({ platform: "darwin", resolvePackage: () => "/private/package.json", exists: () => true }),
    ).not.toBeNull();
  } finally {
    process.report!.getReport = previous;
  }
});
