import { describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type ShellEnvInput = {
  sessionID?: string;
  callID?: string;
  cwd?: string;
};

type ShellEnvOutput = {
  env: Record<string, string>;
};

const loadBridgeFactory = async () => {
  const modulePath = join(import.meta.dirname, "pstdio-session-bridge.js");
  const moduleUrl = `${pathToFileURL(modulePath).href}?cache-bust=${crypto.randomUUID()}`;
  const mod = (await import(moduleUrl)) as {
    PstdioSessionBridgePlugin: (input?: {
      resolveSessionId?: (input: ShellEnvInput) => Promise<string | null> | string | null;
    }) => Promise<{
      "shell.env": (input: ShellEnvInput, output: ShellEnvOutput) => Promise<void>;
    }>;
  };
  return mod.PstdioSessionBridgePlugin;
};

describe("pstdio-session-bridge plugin", () => {
  test("maps OpenCode sessionID to PSTDIO_SESSION_ID via CLI resolver", async () => {
    const resolveSessionId = mock(async () => "sess-123");

    const factory = await loadBridgeFactory();
    const plugin = await factory({ resolveSessionId });
    const output = { env: {} as Record<string, string> };

    await plugin["shell.env"]({ sessionID: "opencode-1", callID: "call-1", cwd: "/repo/a" }, output);

    expect(output.env.PSTDIO_SESSION_ID).toBe("sess-123");
    expect(output.env.OPENCODE_EXECUTOR_SESSION_ID).toBeUndefined();
    expect(output.env.OPENCODE_EXECUTOR_CALL_ID).toBeUndefined();
    expect(resolveSessionId).toHaveBeenCalledWith({
      sessionID: "opencode-1",
      callID: "call-1",
      cwd: "/repo/a",
    });
  });

  test("skips CLI mapping when sessionID is absent", async () => {
    const resolveSessionId = mock(async () => "sess-123");

    const factory = await loadBridgeFactory();
    const plugin = await factory({ resolveSessionId });
    const output = { env: {} as Record<string, string> };

    await plugin["shell.env"]({ callID: "call-only" }, output);

    expect(output.env.PSTDIO_SESSION_ID).toBeUndefined();
    expect(output.env.OPENCODE_EXECUTOR_SESSION_ID).toBeUndefined();
    expect(output.env.OPENCODE_EXECUTOR_CALL_ID).toBeUndefined();
    expect(resolveSessionId).not.toHaveBeenCalled();
  });

  test("keeps shell execution non-blocking when CLI resolver fails", async () => {
    const resolveSessionId = mock(async () => {
      throw new Error("network failure");
    });

    const factory = await loadBridgeFactory();
    const plugin = await factory({ resolveSessionId });
    const output = { env: {} as Record<string, string> };

    await expect(plugin["shell.env"]({ sessionID: "opencode-2", callID: "call-2" }, output)).resolves.toBeUndefined();

    expect(output.env.PSTDIO_SESSION_ID).toBeUndefined();
    expect(output.env.OPENCODE_EXECUTOR_SESSION_ID).toBeUndefined();
    expect(output.env.OPENCODE_EXECUTOR_CALL_ID).toBeUndefined();
  });
});
