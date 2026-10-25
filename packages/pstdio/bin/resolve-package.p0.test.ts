import { describe, expect, test } from "bun:test";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolvePackageName } = require("./resolve-package.cjs") as {
  resolvePackageName: (platform: string, arch: string, libc?: "glibc" | "musl" | null) => string | null;
};

describe("resolvePackageName", () => {
  test("darwin arm64", () => {
    expect(resolvePackageName("darwin", "arm64")).toBe("@pstdio/cli-darwin-arm64");
  });

  test("darwin x64", () => {
    expect(resolvePackageName("darwin", "x64")).toBe("@pstdio/cli-darwin-x64");
  });

  test("linux x64", () => {
    expect(resolvePackageName("linux", "x64", "glibc")).toBe("@pstdio/cli-linux-x64");
  });

  test("linux arm64", () => {
    expect(resolvePackageName("linux", "arm64", "glibc")).toBe("@pstdio/cli-linux-arm64");
  });

  test("returns null for linux x64 musl", () => {
    expect(resolvePackageName("linux", "x64", "musl")).toBeNull();
  });

  test("returns null for linux arm64 musl", () => {
    expect(resolvePackageName("linux", "arm64", "musl")).toBeNull();
  });

  test("win32 x64", () => {
    expect(resolvePackageName("win32", "x64")).toBe("@pstdio/cli-win-x64");
  });

  test("win32 arm64", () => {
    expect(resolvePackageName("win32", "arm64")).toBe("@pstdio/cli-win-arm64");
  });

  test("returns null for unsupported platform", () => {
    expect(resolvePackageName("freebsd", "x64")).toBeNull();
  });

  test("returns null for unsupported arch", () => {
    expect(resolvePackageName("darwin", "ppc64")).toBeNull();
  });
});
