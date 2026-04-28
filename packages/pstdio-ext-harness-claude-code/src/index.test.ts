import { describe, expect, test } from "bun:test";
import extension, { CLAUDE_CODE_HARNESS_EXTENSION_ID } from "./index";

describe("Claude Code harness extension definition", () => {
  test("exposes a first-party harness provider", () => {
    const provider = extension.harnesses?.claudeCode;

    expect(extension.id).toBe(CLAUDE_CODE_HARNESS_EXTENSION_ID);
    expect(provider).toEqual(
      expect.objectContaining({
        id: CLAUDE_CODE_HARNESS_EXTENSION_ID,
        label: "Claude Code",
      }),
    );
    expect(typeof provider?.startSession).toBe("function");
    expect(typeof provider?.resumeSession).toBe("function");
    expect(typeof provider?.getMessages).toBe("function");
  });
});
