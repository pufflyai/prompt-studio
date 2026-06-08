import { describe, expect, test } from "bun:test";
import type { SessionLifecyclePayload } from "@pstdio/sdk/extensions";
import { type RunExtensionCommand, resolveSessionLifecyclePayload, type SessionHookDeps } from "./session-hooks";

const session = { id: "sess-1", project_id: "proj-1", status: "in_progress" };

const resolve = (...args: Parameters<typeof resolveSessionLifecyclePayload>) =>
  resolveSessionLifecyclePayload(...args) as Promise<SessionLifecyclePayload>;

const depsWithWorkspace = (workspace: unknown): SessionHookDeps =>
  ({
    workspaceSessionService: { getWorkspaceBySessionId: async () => workspace },
  }) as unknown as SessionHookDeps;

const runCommand = (responses: Record<string, { ok: boolean; value?: unknown }>) =>
  (async (_deps: unknown, _projectId: string, command: string) =>
    responses[command] ?? { ok: false }) as unknown as RunExtensionCommand;

describe("resolveSessionLifecyclePayload", () => {
  test("resolves the ticket and its status name through the extension runtime", async () => {
    const deps = depsWithWorkspace({
      id: "ws-1",
      workspace_shorthand: "T-1_A1",
      ticket_shorthand: "T-1",
      worktree_path: "/wt/1",
      branch: "feature/t-1",
    });

    const payload = await resolve(
      deps,
      session,
      runCommand({
        "pstdio-planner.get-ticket": { ok: true, value: { id: "id-1", shorthand: "T-1", statusId: "s-progress" } },
        "pstdio-planner.ticketStatus.read": {
          ok: true,
          value: [{ id: "s-progress", name: "In Progress" }],
        },
      }),
    );

    expect(payload.ticket?.shorthand).toBe("T-1");
    expect(payload.ticket?.status_name).toBe("In Progress");
    expect(payload.workspace?.ticket_shorthand).toBe("T-1");
  });

  test("falls back gracefully when the extension command is unavailable", async () => {
    const deps = depsWithWorkspace({ id: "ws-1", workspace_shorthand: "T-1_A1", ticket_shorthand: "T-1" });

    const payload = await resolve(deps, session, (async () => {
      throw new Error("extension runtime unavailable");
    }) as unknown as RunExtensionCommand);

    expect(payload.ticket).toBeUndefined();
    expect(payload.workspace?.ticket_shorthand).toBe("T-1");
  });
});
