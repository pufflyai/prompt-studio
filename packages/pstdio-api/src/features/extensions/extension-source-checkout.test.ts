import { describe, expect, mock, test } from "bun:test";
import { createSharedNamedSourceCheckout } from "./extension-source-checkout";

describe("createSharedNamedSourceCheckout", () => {
  test("passes cancellation to every Git operation", async () => {
    const controller = new AbortController();
    const calls: Array<{ signal?: AbortSignal }> = [];
    const runCommand = mock(async (_command: string, _args: string[], options: { signal?: AbortSignal }) => {
      calls.push(options);
      return { exitCode: 0, stderr: "", stdout: "commit" };
    });
    const checkout = await createSharedNamedSourceCheckout(["pstdio-planner"], {
      runCommand,
      signal: controller.signal,
    });

    try {
      expect(runCommand).toHaveBeenCalledTimes(3);
      expect(calls.every((call) => call.signal === controller.signal)).toBe(true);
    } finally {
      checkout.cleanup();
    }
  });
});
