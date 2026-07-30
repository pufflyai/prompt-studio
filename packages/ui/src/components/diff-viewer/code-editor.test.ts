import { describe, expect, test } from "bun:test";
import { createCodeEditorPreloader } from "./code-editor";

describe("code editor preloading", () => {
  test("initializes Monaco only once", async () => {
    let initializationCount = 0;
    const initialization = Promise.resolve();
    const preload = createCodeEditorPreloader(() => {
      initializationCount += 1;
      return initialization;
    });

    expect(preload()).toBe(initialization);
    expect(preload()).toBe(initialization);
    await initialization;
    expect(initializationCount).toBe(1);
  });
});
