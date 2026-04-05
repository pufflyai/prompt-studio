import { describe, expect, test } from "bun:test";
import { withHookSessionClient } from "./hook-client";

const makeClient = () => {
  const calls: Array<{ sessionId: string; input: Record<string, unknown> }> = [];

  const client = {
    sessions: {
      followUp: async (sessionId: string, input: Record<string, unknown>) => {
        calls.push({ sessionId, input });
        return { id: sessionId } as never;
      },
    },
  } as never;

  return { client, calls };
};

describe("withHookSessionClient", () => {
  test("prefers originalSessionId and strips template and vars from followup input", async () => {
    const { client, calls } = makeClient();
    const hookClient = withHookSessionClient(client, {
      sessionId: "sess-current",
      originalSessionId: "sess-original",
    });

    await hookClient.session.followup({
      prompt: "continue from review feedback",
      model: "gpt-5.4",
      template: "ignored-template",
      vars: { ticket: "PS-1" },
    } as never);

    expect(calls).toEqual([
      {
        sessionId: "sess-original",
        input: {
          prompt: "continue from review feedback",
          model: "gpt-5.4",
        },
      },
    ]);
  });

  test("falls back to sessionId when originalSessionId is missing", async () => {
    const { client, calls } = makeClient();
    const hookClient = withHookSessionClient(client, { sessionId: "sess-current" });

    await hookClient.session.followup({ prompt: "continue" });

    expect(calls).toEqual([{ sessionId: "sess-current", input: { prompt: "continue" } }]);
  });

  test("throws when no session id is available on hook context", async () => {
    const { client } = makeClient();
    const hookClient = withHookSessionClient(client, {});

    await expect(hookClient.session.followup({ prompt: "continue" })).rejects.toThrow(
      "ctx.client.session.followup requires sessionId or originalSessionId in hook context",
    );
  });
});
