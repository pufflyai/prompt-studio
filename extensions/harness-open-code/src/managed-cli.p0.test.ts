import { expect, test } from "bun:test";
import { join } from "node:path";
import { resolveManagedOpencode, resolveOpencodeCommand } from "./cli";

for (const platform of ["darwin", "linux", "win32"] as const) {
  for (const arch of ["x64", "arm64"]) {
    test(`resolves the private native CLI for ${platform} ${arch}`, () => {
      const command = resolveManagedOpencode({
        platform,
        arch,
        resolvePackage: (name) => {
          const os = platform === "win32" ? "windows" : platform;
          const baseline = arch === "x64" ? "-baseline" : "";
          expect(name).toBe(`@opencode/cli-${os}-${arch}${baseline}`);
          return join("/packages", name, "package.json");
        },
        musl: false,
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

test("uses the OpenCode 2 executable beside a Windows npm shim", () => {
  const native = "C:\\npm\\node_modules\\@opencode\\cli\\bin\\opencode.exe";
  expect(
    resolveOpencodeCommand({
      platform: "win32",
      which: () => "C:\\npm\\opencode.cmd",
      exists: (path) => path === native,
      managed: () => "/private/cli",
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
