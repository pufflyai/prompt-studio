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
      hostReleaseRef: "main",
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

  test("ends git options before the repository URL and allows only https and file transport", async () => {
    const calls: string[][] = [];
    const runCommand = mock(async (_command: string, args: string[]) => {
      calls.push(args);
      return { exitCode: 0, stderr: "", stdout: "commit" };
    });
    const checkout = await createSharedNamedSourceCheckout(["pstdio-planner"], { hostReleaseRef: "main", runCommand });

    try {
      const clone = calls.find((args) => args.includes("clone")) ?? [];
      expect(clone.slice(0, 6)).toEqual([
        "-c",
        "protocol.allow=never",
        "-c",
        "protocol.https.allow=always",
        "-c",
        "protocol.file.allow=always",
      ]);
      expect(clone.slice(-3, -1)).toEqual(["--", "https://github.com/pufflyai/prompt-studio"]);
    } finally {
      checkout.cleanup();
    }
  });
});
