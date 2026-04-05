import { describe, expect, it } from "bun:test";
import { followupSession } from "./followup-session";

describe("followupSession", () => {
  it("uses an explicit session id when provided", async () => {
    const calls: Array<{ sessionId: string; input: Record<string, unknown> }> = [];
    const session = { id: "session-2" } as never;

    const ctx = {
      projectId: "proj-1",
      sessionId: "session-current",
      originalSessionId: "session-original",
      client: {
        sessions: {
          followUp: async (sessionId: string, input: Record<string, unknown>) => {
            calls.push({ sessionId, input });
            return session;
          },
        },
      },
    } as never;

    const result = await followupSession(ctx, {
      sessionId: "session-explicit",
      template: "fix-changes-requested",
      vars: { ticket: "PS-1" },
    });

    expect(result).toBe(session);
    expect(calls).toEqual([
      {
        sessionId: "session-explicit",
        input: {
          template: "fix-changes-requested",
          vars: { ticket: "PS-1" },
        },
      },
    ]);
  });

  it("falls back to originalSessionId before sessionId", async () => {
    const calls: Array<{ sessionId: string; input: Record<string, unknown> }> = [];

    const ctx = {
      projectId: "proj-1",
      sessionId: "session-current",
      originalSessionId: "session-original",
      client: {
        sessions: {
          followUp: async (sessionId: string, input: Record<string, unknown>) => {
            calls.push({ sessionId, input });
            return { id: sessionId } as never;
          },
        },
      },
    } as never;

    await followupSession(ctx, {
      prompt: "Continue with the requested changes.",
    });

    expect(calls).toEqual([
      {
        sessionId: "session-original",
        input: {
          prompt: "Continue with the requested changes.",
        },
      },
    ]);
  });
});
