import { describe, expect, test } from "bun:test";
import extension, { FAKE_HARNESS_EXTENSION_ID } from "./index";

describe("fake harness extension definition", () => {
  test("exposes the fake harness provider", () => {
    const provider = extension.harnesses?.fake;

    expect(extension.id).toBe(FAKE_HARNESS_EXTENSION_ID);
    expect(provider).toEqual(
      expect.objectContaining({
        id: FAKE_HARNESS_EXTENSION_ID,
        label: "Fake Agent",
      }),
    );
    expect(typeof provider?.startSession).toBe("function");
    expect(typeof provider?.resumeSession).toBe("function");
    expect(typeof provider?.getMessages).toBe("function");
  });
});
