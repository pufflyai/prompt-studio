import { describe, expect, test } from "bun:test";
import { parseExtensionApiVersions, supportsExtensionApiVersion } from "./api-versions";

describe("explicit extension API versions", () => {
  test("reads exact versions separated by OR with surrounding whitespace", () => {
    expect(parseExtensionApiVersions(" 1.0.0-alpha.10 || 1.0.0-alpha.11 ")).toEqual([
      "1.0.0-alpha.10",
      "1.0.0-alpha.11",
    ]);
    expect(parseExtensionApiVersions("1.0.0-alpha.10||1.0.0-alpha.11")).toEqual(["1.0.0-alpha.10", "1.0.0-alpha.11"]);
  });

  test("supports only the exact versions an author lists", () => {
    const declaration = "1.0.0-alpha.10 || 1.0.0-alpha.12";
    expect(supportsExtensionApiVersion(declaration, "1.0.0-alpha.10")).toBe(true);
    expect(supportsExtensionApiVersion(declaration, "1.0.0-alpha.12")).toBe(true);
    expect(supportsExtensionApiVersion(declaration, "1.0.0-alpha.11")).toBe(false);
    expect(supportsExtensionApiVersion("1.0.0-alpha.10", "1.0.0-alpha.11")).toBe(false);
  });

  test.each([
    "",
    " ",
    "1.0",
    "01.0.0",
    "1.0.0-alpha.01",
    "1.0.0-alpha.",
    "v1.0.0-alpha.10",
    "1.0.0-alpha.10 - 1.0.0-alpha.11",
    "1.0.0-alpha.10 1.0.0-alpha.11",
    "1.0.0-alpha.10,1.0.0-alpha.11",
    "1.0.0-alpha.10 || *",
    "1.0.0-alpha.10 || ^1.0.0-alpha.11",
    "1.0.0-alpha.10 ||",
  ])("rejects an invalid or open-ended declaration: %s", (declaration) => {
    expect(parseExtensionApiVersions(declaration)).toBeNull();
    expect(supportsExtensionApiVersion(declaration, "1.0.0-alpha.10")).toBe(false);
  });
});
