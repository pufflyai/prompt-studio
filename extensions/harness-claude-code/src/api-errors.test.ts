import { describe, expect, test } from "bun:test";
import { normalizeClaudeCodeStream } from "./normalize-stream";
import { normalizeClaudeCodeMessages } from "./normalize-transcript";
import type { RawLogEvent } from "./types";

// Claude Code 2.1 writes this synthetic reply when it has no login (captured from `claude -p --output-format stream-json`).
const notLoggedIn = {
  type: "assistant",
  uuid: "a-1",
  timestamp: "2026-10-06T10:44:22.955Z",
  message: {
    model: "<synthetic>",
    role: "assistant",
    content: [{ type: "text" as const, text: "Not logged in · Please run /login" }],
  },
  error: "authentication_failed",
  is_api_error_message: true,
};

const collect = async (events: RawLogEvent[]) => {
  async function* stream() {
    for (const event of events) yield event;
  }
  const result = [];
  for await (const message of normalizeClaudeCodeStream(stream())) result.push(message);
  return result;
};

describe("Claude Code API errors", () => {
  test("shows a missing login as an error with a next step", async () => {
    const [message] = await collect([{ type: "stdout", data: JSON.stringify(notLoggedIn) }]);

    expect(message).toMatchObject({
      role: "assistant",
      parts: [{ type: "error", errorType: "permission", message: expect.stringContaining("not signed in") }],
    });
  });

  test("shows the same error when the conversation is read back from the transcript", async () => {
    const [streamed] = await collect([{ type: "stdout", data: JSON.stringify(notLoggedIn) }]);
    const [restored] = normalizeClaudeCodeMessages([notLoggedIn]);

    expect(restored?.parts).toEqual(streamed?.parts);
  });
});
