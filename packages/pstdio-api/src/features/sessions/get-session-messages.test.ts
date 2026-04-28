import { describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionMessage } from "pstdio-agents";
import { getSessionMessages } from "./get-session-messages";

describe("getSessionMessages harness identities", () => {
  test("loads messages from the extension-backed harness provider", async () => {
    const getMessages = mock(async () => [{ id: "m1", role: "assistant", parts: [{ type: "text", text: "hi" }] }]);
    const resolve = mock(async () => ({
      provider: { getMessages },
      context: {},
    }));

    const deps = {
      fileService: { get: async () => null },
      harnessProviderService: { resolve },
      sessionService: {
        get: async () => ({
          id: "session-1",
          agent: "pstdio.harness.opencode",
          agent_session_id: "oc-1",
          cwd: "/repo",
          project_id: "p1",
          session_file_id: null,
        }),
        store: { get: () => undefined },
      },
    } as unknown as Parameters<typeof getSessionMessages>[1];

    const messages = await getSessionMessages("session-1", deps);

    expect(resolve).toHaveBeenCalledWith("pstdio.harness.opencode", "p1");
    expect(getMessages).toHaveBeenCalledWith({}, "oc-1", { cwd: "/repo" });
    expect(messages).toHaveLength(1);
  });

  test("returns provider messages directly without legacy fallback", async () => {
    const providerGetMessages = mock(async () => []);
    const resolve = mock(async () => ({
      provider: { getMessages: providerGetMessages },
      context: {},
    }));

    const deps = {
      fileService: { get: async () => null },
      harnessProviderService: { resolve },
      sessionService: {
        get: async () => ({
          id: "session-1",
          agent: "fake",
          agent_session_id: "fake-1",
          cwd: "/repo",
          project_id: "p1",
          session_file_id: null,
        }),
        store: { get: () => undefined },
      },
    } as unknown as Parameters<typeof getSessionMessages>[1];

    const messages = await getSessionMessages("session-1", deps);

    expect(resolve).toHaveBeenCalledWith("fake", "p1");
    expect(providerGetMessages).toHaveBeenCalledWith({}, "fake-1", { cwd: "/repo" });
    expect(messages).toEqual([]);
  });

  test("falls back to persisted messages when the harness provider is unavailable", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-get-session-messages-test-"));

    try {
      const storagePath = join(tempRoot, "messages.json");
      const persistedMessages = [
        { id: "m1", role: "assistant", parts: [{ type: "text", text: "persisted reply" }] },
      ] satisfies SessionMessage[];
      writeFileSync(storagePath, JSON.stringify(persistedMessages));

      const resolve = mock(async () => null);
      const deps = {
        fileService: { get: async () => ({ storage_path: storagePath }) },
        harnessProviderService: { resolve },
        sessionService: {
          get: async () => ({
            id: "session-1",
            agent: "pstdio.harness.opencode",
            agent_session_id: "oc-1",
            cwd: "/repo",
            project_id: "p1",
            session_file_id: "file-1",
          }),
          store: { get: () => undefined },
        },
      } as unknown as Parameters<typeof getSessionMessages>[1];

      const messages = await getSessionMessages("session-1", deps);

      expect(resolve).toHaveBeenCalledWith("pstdio.harness.opencode", "p1");
      expect(messages).toEqual(persistedMessages);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
