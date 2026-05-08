import { describe, expect, test } from "bun:test";
import { EXTENSION_IFRAME_SANDBOX } from "./extension-frame";

describe("ExtensionFrame sandbox", () => {
  test("does not grant same-origin script access", () => {
    expect(EXTENSION_IFRAME_SANDBOX.split(" ")).not.toContain("allow-same-origin");
  });
});
