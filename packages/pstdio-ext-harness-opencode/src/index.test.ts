import { describe, expect, test } from "bun:test";
import extension, { OPENCODE_HARNESS_EXTENSION_ID } from "./index";

describe("OpenCode harness extension definition", () => {
  test("exposes a first-party harness provider", () => {
    const provider = extension.harnesses?.opencode;

    expect(extension.id).toBe(OPENCODE_HARNESS_EXTENSION_ID);
    expect(provider).toEqual(
      expect.objectContaining({
        id: OPENCODE_HARNESS_EXTENSION_ID,
        label: "OpenCode",
      }),
    );
    expect(typeof provider?.startSession).toBe("function");
    expect(typeof provider?.resumeSession).toBe("function");
    expect(typeof provider?.getMessages).toBe("function");
  });
});
