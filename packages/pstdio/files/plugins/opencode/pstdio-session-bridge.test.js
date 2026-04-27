import { describe, expect, mock, test } from "bun:test";
import { createPstdioSessionResolver } from "./pstdio-session-bridge.js";

describe("pstdio opencode session bridge", () => {
  test("resolves sessions through the canonical opencode harness id", async () => {
    const execFileSync = mock(() => JSON.stringify({ session_id: "session-1" }));
    const resolveSessionId = createPstdioSessionResolver(execFileSync);

    await expect(resolveSessionId({ sessionID: "oc-1", cwd: "/repo" })).resolves.toBe("session-1");

    expect(execFileSync).toHaveBeenCalledWith(
      "pstdio",
      [
        "sessions",
        "resolve-session-id",
        "--harness",
        "pstdio.harness.opencode",
        "--agent-session-id",
        "oc-1",
        "--json",
        "--cwd",
        "/repo",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
  });
});
