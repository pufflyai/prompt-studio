import { describe, expect, mock, test } from "bun:test";
import { getSessionMessages } from "./get-session-messages";

describe("getSessionMessages harness identities", () => {
  test("uses the extension-backed harness provider before the legacy registry", async () => {
    const getMessages = mock(async () => [{ id: "m1", role: "assistant", parts: [{ type: "text", text: "hi" }] }]);
    const resolve = mock(async () => ({
      provider: { getMessages },
      context: {},
    }));
    const registryGet = mock(() => ({ getMessages }));

    const deps = {
      agentRegistry: { get: registryGet },
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
    expect(registryGet).not.toHaveBeenCalled();
    expect(getMessages).toHaveBeenCalledWith({}, "oc-1", { cwd: "/repo" });
    expect(messages).toHaveLength(1);
  });

  test("falls back to the legacy registry when a resolved provider has no messages", async () => {
    const providerGetMessages = mock(async () => []);
    const legacyGetMessages = mock(async () => [
      { id: "m1", role: "assistant", parts: [{ type: "text", text: "from legacy" }] },
    ]);
    const resolve = mock(async () => ({
      provider: { getMessages: providerGetMessages },
      context: {},
    }));
    const registryGet = mock(() => ({ getMessages: legacyGetMessages }));

    const deps = {
      agentRegistry: { get: registryGet },
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
    expect(registryGet).toHaveBeenCalledWith("fake");
    expect(legacyGetMessages).toHaveBeenCalledWith("fake-1", { cwd: "/repo" });
    expect(messages).toEqual([{ id: "m1", role: "assistant", parts: [{ type: "text", text: "from legacy" }] }]);
  });
});
