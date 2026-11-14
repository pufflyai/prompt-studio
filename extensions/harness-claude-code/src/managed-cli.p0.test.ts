import { expect, test } from "bun:test";
import { join } from "node:path";
import { resolveClaudeCommand, resolveManagedClaude } from "./cli";

for (const platform of ["darwin", "linux", "win32"] as const) {
  for (const arch of ["x64", "arm64"]) {
    test(`resolves the private native CLI for ${platform} ${arch}`, () => {
      const command = resolveManagedClaude({
        platform,
        arch,
        resolvePackage: (name) => join("/packages", name, "package.json"),
        exists: () => true,
      });
      expect(command).not.toBeNull();
      expect(command).toEndWith(platform === "win32" ? "claude.exe" : "claude");
    });
  }
}

test("reports a missing native dependency without invoking an installer", () => {
  expect(
    resolveManagedClaude({
      resolvePackage: () => {
        throw new Error("Not installed");
      },
    }),
  ).toBeNull();
});

test("prefers an existing CLI and otherwise uses the managed CLI", () => {
  expect(resolveClaudeCommand({ which: () => "/tools/cli", managed: () => "/private/cli" })).toBe("/tools/cli");
  expect(resolveClaudeCommand({ which: () => null, managed: () => "/private/cli" })).toBe("/private/cli");
});

test("uses a native executable for interactive sign-in through a Windows npm shim", () => {
  const native = "C:\\npm\\native.exe";
  expect(
    resolveClaudeCommand({
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
      resolveManagedClaude({ platform: "darwin", resolvePackage: () => "/private/package.json", exists: () => true }),
    ).not.toBeNull();
  } finally {
    process.report!.getReport = previous;
  }
});
