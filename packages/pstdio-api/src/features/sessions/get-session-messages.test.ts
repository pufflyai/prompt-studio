import { describe, expect, mock, test } from "bun:test";
import { getSessionMessages } from "./get-session-messages";

describe("getSessionMessages harness identities", () => {
  test("normalizes harness id before provider message lookup", async () => {
    const getMessages = mock(async () => [{ id: "m1", role: "assistant", parts: [{ type: "text", text: "hi" }] }]);
    const registryGet = mock(() => ({ getMessages }));

    const deps = {
      agentRegistry: { get: registryGet },
      fileService: { get: async () => null },
      sessionService: {
        get: async () => ({
          id: "session-1",
          agent: "pstdio.harness.opencode",
          agent_session_id: "oc-1",
          cwd: "/repo",
          session_file_id: null,
        }),
        store: { get: () => undefined },
      },
    } as unknown as Parameters<typeof getSessionMessages>[1];

    const messages = await getSessionMessages("session-1", deps);

    expect(registryGet).toHaveBeenCalledWith("opencode");
    expect(getMessages).toHaveBeenCalledWith("oc-1", { cwd: "/repo" });
    expect(messages).toHaveLength(1);
  });
});
