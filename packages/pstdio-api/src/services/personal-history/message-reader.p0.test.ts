import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionMessage } from "pstdio-api-contracts";
import { toolResultBytes } from "pstdio-api-contracts";
import { messageEntries } from "./log-entries";
import { createSessionLogFiles } from "./log-files";
import { createPersonalMessageReader } from "./message-reader";

test("every synced history reader receives bounded legacy results", async () => {
  const root = await mkdtemp(join(tmpdir(), "bounded-history-"));
  const logs = createSessionLogFiles(root);
  const message: SessionMessage = {
    id: "tool",
    role: "assistant",
    parts: [{ type: "tool", tool: "shell", state: { output: "x".repeat(1000000) } }],
  };
  try {
    await logs.append("namespace", "session", messageEntries(0, message));
    const reader = createPersonalMessageReader({
      context: async () => ({ identity: "account", namespace: "namespace", history: {} as never }),
      sessions: async () => [{ id: "session", status: "completed" }],
      logs,
      refreshIdentity: async () => {},
      identity: () => "account",
    });
    const messages = await reader.messages("session", "project");
    const part = messages?.[0].parts[0];
    if (part?.type !== "tool") throw new Error("Missing tool result");
    expect(toolResultBytes(part)).toBeLessThanOrEqual(262144);
    expect(part.state?.resultSummary?.originalBytes).toBe(1000000);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
