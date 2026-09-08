import { expect } from "bun:test";
import { startPocketCoderFixture } from "./pocketcoder-service-fixture";

export const verifyPocketCoderLifecycle = async (
  baseUrl: string,
  headers: Record<string, string>,
  projectId: string,
) => {
  const remote = startPocketCoderFixture();
  const call = async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`${baseUrl}/v1${path}`, {
      method,
      headers: { ...headers, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text}`);
    const result = JSON.parse(text);
    return result;
  };
  const waitForConversation = async (sessionId: string, messageCount: number) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const conversation = await call(`/sessions/${sessionId}/conversation`);
      if (conversation.session.status === "completed" && conversation.messages.length === messageCount)
        return conversation;
      if (conversation.session.status === "failed") throw new Error(JSON.stringify(conversation));
      await Bun.sleep(100);
    }
    throw new Error("PocketCoder conversation did not complete.");
  };
  try {
    const connectionPath = `/projects/${projectId}/extension-connections/pstdio.remote-workspaces/pocketcoder`;
    const configured = await call(connectionPath, "PUT", {
      baseUrl: remote.server.url.toString(),
      secret: remote.secret,
    });
    expect(JSON.stringify(configured)).not.toContain(remote.secret);
    expect(await call(`${connectionPath}/check`, "POST")).toMatchObject({ lastCheck: { ok: true } });
    const launched = await call(
      `/projects/${projectId}/extensions/commands/pstdio.remote-workspaces.command.launch/execute`,
      "POST",
      {
        source: "api",
        params: { template: "pi-harness", prompt: "First turn" },
      },
    );
    expect(launched.outcome).toMatchObject({ ok: true });
    const { sessionId, workspaceId } = launched.outcome.value as { sessionId: string; workspaceId: string };
    const first = await waitForConversation(sessionId, 2);
    expect(first.messages[1]).toMatchObject({
      role: "assistant",
      parts: [{ type: "text", text: "PocketCoder reply 1" }],
    });
    expect(remote.created()).toMatchObject({
      input: { external_id: workspaceId, template: { name: "pi-harness" } },
      idempotencyKey: expect.any(String),
    });
    const workspaces = await call(`/workspaces?project_id=${projectId}`);
    expect(workspaces.find((workspace: { id: string }) => workspace.id === workspaceId)).toMatchObject({
      execution_kind: "remote",
      provider_state: "ready",
      worktree_path: null,
    });
    await call(`/sessions/${sessionId}/follow-up`, "POST", { prompt: "Second turn" });
    const second = await waitForConversation(sessionId, 4);
    expect(second.messages[3]).toMatchObject({
      role: "assistant",
      parts: [{ type: "text", text: "PocketCoder reply 2" }],
    });
    expect(remote.prompts).toEqual(["First turn", "Second turn"]);
    expect(await call(`/workspaces/${workspaceId}`, "DELETE")).toMatchObject({ deleted: true });
    expect(remote.state()).toBe("canceled");
  } finally {
    remote.server.stop(true);
  }
};
