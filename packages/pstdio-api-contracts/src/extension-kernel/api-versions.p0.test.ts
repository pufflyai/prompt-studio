import { describe, expect, test } from "bun:test";
import { parseExtensionApiDeclaration, supportsExtensionApiVersion } from "./api-versions";

describe("extension API declarations", () => {
  test("reads the minimum version of each caret term", () => {
    expect(parseExtensionApiDeclaration("^0.4.2")).toEqual(["0.4.2"]);
    expect(parseExtensionApiDeclaration(" ^0.4.2 || ^0.5.0 ")).toEqual(["0.4.2", "0.5.0"]);
    expect(parseExtensionApiDeclaration("^0.4.2||^0.5.0")).toEqual(["0.4.2", "0.5.0"]);
  });

  test("keeps an extension loading across additive host releases", () => {
    expect(supportsExtensionApiVersion("^0.4.0", "0.4.0")).toBe(true);
    expect(supportsExtensionApiVersion("^0.4.0", "0.4.3")).toBe(true);
  });

  test("refuses a host older than the declared minimum", () => {
    expect(supportsExtensionApiVersion("^0.4.2", "0.4.1")).toBe(false);
  });

  test("refuses a host on a newer breaking line", () => {
    expect(supportsExtensionApiVersion("^0.4.0", "0.5.0")).toBe(false);
    expect(supportsExtensionApiVersion("^0.9.0", "1.0.0")).toBe(false);
    expect(supportsExtensionApiVersion("^1.4.0", "2.0.0")).toBe(false);
  });

  test("reads terms separated by any whitespace around OR", () => {
    expect(supportsExtensionApiVersion("^0.4.2\t||\t^0.5.0", "0.5.1")).toBe(true);
    expect(supportsExtensionApiVersion("^0.4.2\u00a0", "0.4.2")).toBe(true);
  });

  test("lets one build support two breaking lines", () => {
    expect(supportsExtensionApiVersion("^0.4.2 || ^0.5.0", "0.4.3")).toBe(true);
    expect(supportsExtensionApiVersion("^0.4.2 || ^0.5.0", "0.5.1")).toBe(true);
  });

  test.each([
    "",
    " ",
    "0.4.0",
    "~0.4.0",
    "0.x",
    "*",
    ">=0.4.0",
    "^0.4",
    "^00.4.0",
    "^v0.4.0",
    "^0.4.0-alpha",
    "^0.4.0+build",
    "1.0.0-alpha.14",
    "^1.0.0-alpha.1",
    "^0.4.0 || *",
    "^0.4.0 ||",
    "^0.4.0 ^0.5.0",
  ])("refuses a declaration that is not caret terms: %s", (declaration) => {
    expect(parseExtensionApiDeclaration(declaration)).toBeNull();
    expect(supportsExtensionApiVersion(declaration, "0.4.0")).toBe(false);
  });
});
