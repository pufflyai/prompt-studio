import { describe, expect, test } from "bun:test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { getExtensionApiVersionError } from "./extension-api-version";

describe("getExtensionApiVersionError", () => {
  test("accepts the exact host version", () => {
    expect(getExtensionApiVersionError("planner", EXTENSION_API_VERSION)).toBeNull();
  });

  test("rejects version ranges", () => {
    expect(getExtensionApiVersionError("planner", `^${EXTENSION_API_VERSION}`)).toContain("not a range");
  });

  test("tells the user to update the extension when it is older than the host", () => {
    const message = getExtensionApiVersionError("planner", "1.0.0-alpha.1");

    expect(message).toContain("pst extensions update planner");
    expect(message).not.toContain("Update Prompt Studio");
  });

  test("tells the user to update Prompt Studio when the extension is newer than the host", () => {
    const message = getExtensionApiVersionError("planner", "1.0.0-alpha.999");

    expect(message).toContain("Update Prompt Studio");
    expect(message).not.toContain("pst extensions update");
  });

  test("treats an unparseable declared version as an extension problem", () => {
    expect(getExtensionApiVersionError("planner", "banana")).toContain("pst extensions update planner");
  });
});
