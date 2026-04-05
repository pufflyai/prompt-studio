import { describe, expect, test } from "bun:test";
import { createHookDispatcher } from "pstdio-hooks";
import type { LoadedPlugin } from "pstdio-plugins";
import { registerPluginHooks } from "./register-plugin-hooks";

const makePlugin = (identity: string, hooks: Record<string, (...args: unknown[]) => unknown>): LoadedPlugin => ({
  identity,
  filePath: `/plugins/${identity}.ts`,
  definition: { hooks },
});

describe("registerPluginHooks", () => {
  test("registers plugin hooks with the dispatcher", async () => {
    const dispatcher = createHookDispatcher();
    const called: string[] = [];

    const plugins = [
      makePlugin("a", {
        postSessionStart: () => {
          called.push("a");
        },
      }),
      makePlugin("b", {
        postSessionStart: () => {
          called.push("b");
        },
      }),
    ];

    registerPluginHooks(plugins, dispatcher);

    await dispatcher.firePostHook("postSessionStart", {});
    expect(called).toContain("a");
    expect(called).toContain("b");
  });

  test("registers pre-hooks that can reject", async () => {
    const dispatcher = createHookDispatcher();

    const plugins = [
      makePlugin("guard", {
        preTicketDeletion: () => ({ reject: true, reason: "blocked by plugin" }),
      }),
    ];

    registerPluginHooks(plugins, dispatcher);

    const result = await dispatcher.firePreHook("preTicketDeletion", {});
    expect(result.rejected).toBe(true);
    expect(result.reason).toBe("blocked by plugin");
  });

  test("skips non-function hook values", async () => {
    const dispatcher = createHookDispatcher();

    const plugins = [
      makePlugin("bad", {
        postSessionStart: "not a function" as unknown as (...args: unknown[]) => unknown,
      }),
    ];

    registerPluginHooks(plugins, dispatcher);

    // Should not throw
    await dispatcher.firePostHook("postSessionStart", {});
  });
});
