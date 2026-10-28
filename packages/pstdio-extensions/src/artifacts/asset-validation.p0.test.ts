import { describe, expect, test } from "bun:test";
import { isPackageAssetDescriptor } from "./asset-validation";

describe("isPackageAssetDescriptor", () => {
  test("accepts a valid descriptor", () => {
    expect(isPackageAssetDescriptor({ kind: "package-asset", path: "./templates/x.md", baseUrl: "file:///foo/" })).toBe(
      true,
    );
  });

  test("rejects null and primitives", () => {
    expect(isPackageAssetDescriptor(null)).toBe(false);
    expect(isPackageAssetDescriptor(undefined)).toBe(false);
    expect(isPackageAssetDescriptor("string")).toBe(false);
    expect(isPackageAssetDescriptor(42)).toBe(false);
  });

  test("rejects wrong kind", () => {
    expect(isPackageAssetDescriptor({ kind: "asset", path: "x", baseUrl: "y" })).toBe(false);
  });

  test("rejects missing path", () => {
    expect(isPackageAssetDescriptor({ kind: "package-asset", baseUrl: "y" })).toBe(false);
    expect(isPackageAssetDescriptor({ kind: "package-asset", path: "", baseUrl: "y" })).toBe(false);
  });

  test("rejects missing baseUrl", () => {
    expect(isPackageAssetDescriptor({ kind: "package-asset", path: "x" })).toBe(false);
    expect(isPackageAssetDescriptor({ kind: "package-asset", path: "x", baseUrl: "" })).toBe(false);
  });
});
