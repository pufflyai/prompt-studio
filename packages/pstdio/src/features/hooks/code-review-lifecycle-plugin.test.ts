import { beforeAll, describe, expect, it } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TEMPLATE_DIR = join(import.meta.dirname, "../../../files/plugins/pstdio");

let plugin: { hooks?: Record<string, (...args: never[]) => Promise<void>> };

beforeAll(async () => {
  const src = join(TEMPLATE_DIR, "code-review-lifecycle.ts.txt");
  const tmp = join(TEMPLATE_DIR, `__test_temp_${Date.now()}__.ts`);
  writeFileSync(tmp, readFileSync(src, "utf8"));
  try {
    plugin = (await import(tmp)).default;
  } finally {
    rmSync(tmp, { force: true });
  }
});

describe("default code-review-lifecycle plugin", () => {
  it("creates review sessions linked back to the current implementation session", async () => {
    const createdSessions: Record<string, unknown>[] = [];

    const ctx = {
      projectId: "proj-1",
      sessionId: "sess-implementation",
      toStatus: "review-ready",
      prompts: {},
      workspace: {
        id: "ws-1",
        workspace_shorthand: "PS-1_A1",
        ticket_shorthand: "PS-1",
        attempt_status_name: "review-ready",
      },
      ticket: {
        id: "ticket-1",
        shorthand: "PS-1",
        status_name: "wip",
      },
      client: {
        sessions: {
          create: async (input: Record<string, unknown>) => {
            createdSessions.push(input);
            return { id: "sess-review" };
          },
        },
      },
    } as never;

    await plugin.hooks?.postAttemptStatusChange?.(ctx);

    expect(createdSessions).toEqual([
      {
        project_id: "proj-1",
        workspace_id: "ws-1",
        title: "Code review: PS-1",
        template: "code-review",
        vars: { ticket: "PS-1" },
        original_session_id: "sess-implementation",
      },
    ]);
  });

  it("sends requested changes back to the original implementation session", async () => {
    const followUps: Array<{ sessionId: string; input: Record<string, unknown> }> = [];
    const attemptStatusUpdates: Record<string, unknown>[] = [];

    const ctx = {
      projectId: "proj-1",
      sessionId: "sess-review",
      originalSessionId: "sess-implementation",
      toStatus: "changes-requested",
      prompts: {},
      workspace: {
        id: "ws-1",
        workspace_shorthand: "PS-1_A1",
        ticket_shorthand: "PS-1",
        attempt_status_name: "changes-requested",
      },
      ticket: {
        id: "ticket-1",
        shorthand: "PS-1",
        status_name: "wip",
      },
      client: {
        sessions: {
          followUp: async (sessionId: string, input: Record<string, unknown>) => {
            followUps.push({ sessionId, input });
            return { id: sessionId };
          },
        },
        workspaces: {
          updateAttemptStatus: async (workspaceId: string, input: Record<string, unknown>) => {
            attemptStatusUpdates.push({ workspaceId, ...input });
            return { id: workspaceId };
          },
        },
      },
    } as never;

    await plugin.hooks?.postAttemptStatusChange?.(ctx);

    expect(attemptStatusUpdates).toEqual([
      {
        workspaceId: "ws-1",
        status: "wip",
        session_id: "sess-review",
      },
    ]);
    expect(followUps).toEqual([
      {
        sessionId: "sess-implementation",
        input: {
          template: "fix-changes-requested",
          vars: { ticket: "PS-1" },
        },
      },
    ]);
  });
});
