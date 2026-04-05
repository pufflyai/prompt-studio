import { describe, expect, it } from "bun:test";
import { createSession } from "./create-session";

describe("createSession", () => {
  it("creates a session with project id from helper context", async () => {
    const calls: {
      project_id: string;
      title: string;
      prompt: string;
      workspace_id: string;
    }[] = [];
    const session = { id: "session-1" } as never;

    const ctx = {
      projectId: "proj-1",
      client: {
        sessions: {
          create: async (input: { project_id: string; title: string; prompt: string; workspace_id: string }) => {
            calls.push(input);
            return session;
          },
        },
      },
    } as never;

    const result = await createSession(ctx, {
      title: "Code review: PS-1",
      prompt: "Review ticket PS-1.",
      workspace_id: "ws-1",
    });

    expect(result).toBe(session);
    expect(calls).toEqual([
      {
        project_id: "proj-1",
        title: "Code review: PS-1",
        prompt: "Review ticket PS-1.",
        workspace_id: "ws-1",
      },
    ]);
  });

  it("passes through template and vars", async () => {
    const calls: {
      project_id: string;
      title: string;
      template: string;
      vars: Record<string, string>;
      workspace_id: string;
    }[] = [];
    const session = { id: "session-2" } as never;

    const ctx = {
      projectId: "proj-1",
      client: {
        sessions: {
          create: async (input: {
            project_id: string;
            title: string;
            template: string;
            vars: Record<string, string>;
            workspace_id: string;
          }) => {
            calls.push(input);
            return session;
          },
        },
      },
    } as never;

    const result = await createSession(ctx, {
      title: "Code review: PS-2",
      template: "code-review",
      vars: { ticket: "PS-2" },
      workspace_id: "ws-2",
    });

    expect(result).toBe(session);
    expect(calls).toEqual([
      {
        project_id: "proj-1",
        title: "Code review: PS-2",
        template: "code-review",
        vars: { ticket: "PS-2" },
        workspace_id: "ws-2",
      },
    ]);
  });
});
