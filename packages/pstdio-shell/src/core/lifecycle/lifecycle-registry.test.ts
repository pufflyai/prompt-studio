import { describe, expect, test } from "bun:test";
import { createLifecycleRegistry } from "./lifecycle-registry";

describe("createLifecycleRegistry", () => {
  test("runs lifecycle hooks in contribution priority order", async () => {
    const lifecycle = createLifecycleRegistry();
    const calls: string[] = [];

    lifecycle.registerHook(
      "activate",
      () => {
        calls.push("low");
      },
      { priority: 1 },
    );
    lifecycle.registerHook(
      "activate",
      () => {
        calls.push("high");
      },
      { priority: 10 },
    );

    await lifecycle.runHooks("activate");

    expect(calls).toEqual(["high", "low"]);
  });
});
