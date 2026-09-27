import { describe, expect, test } from "bun:test";
import type { SessionLifecyclePayload } from "pstdio-api-contracts/extension-kernel";
import { resolveSessionLifecyclePayload, type SessionHookDeps } from "./session-hooks";

const session = { id: "sess-1", project_id: "proj-1", status: "in_progress" };

const resolve = (...args: Parameters<typeof resolveSessionLifecyclePayload>) =>
  resolveSessionLifecyclePayload(...args) as Promise<SessionLifecyclePayload>;

const depsWithWorkspace = (workspace: unknown): SessionHookDeps =>
  ({
    workspaceSessionService: { getWorkspaceBySessionId: async () => workspace },
  }) as unknown as SessionHookDeps;

describe("resolveSessionLifecyclePayload", () => {
  test("carries the workspace and its generic resource anchors", async () => {
    const ticketAnchor = { type: "ticket", id: "id-1", label: "T-1", metadata: { shorthand: "T-1" } };
    const deps = depsWithWorkspace({
      id: "ws-1",
      workspace_shorthand: "T-1_A1",
      root_path: "/wt/1",
      branch: "feature/t-1",
      anchors_json: [ticketAnchor],
    });

    const payload = await resolve(deps, session);

    expect(payload.workspaceId).toBe("ws-1");
    expect(payload.workspaceDir).toBe("/wt/1");
    expect(payload.branch).toBe("feature/t-1");
    expect(payload.anchors).toEqual([ticketAnchor]);
    expect(payload.workspace?.anchors_json).toEqual([ticketAnchor]);
  });

  test("reports the stored project folder for a default workspace", async () => {
    const payload = await resolve(
      depsWithWorkspace({
        id: "ws-default",
        project_id: session.project_id,
        provider_id: "pstdio.root",
        is_default: true,
        execution_kind: "local",
        root_path: "/project",
      }),
      session,
    );

    expect(payload.workspaceDir).toBe("/project");
    expect(payload.workspace?.root_path).toBe("/project");
  });

  test("keeps a remote session without a local directory", async () => {
    const providerRef = { version: 1, data: { environmentId: "remote-1" } };
    const payload = await resolve(
      depsWithWorkspace({
        id: "ws-remote",
        project_id: session.project_id,
        provider_id: "cloud.environment",
        provider_ref_json: providerRef,
        execution_kind: "remote",
        root_path: null,
      }),
      session,
    );

    expect(payload.workspaceDir).toBeUndefined();
    expect(payload.workspace).toMatchObject({ root_path: null, provider_ref_json: providerRef });
  });

  test("returns only the base payload when the session has no workspace", async () => {
    const payload = await resolve(depsWithWorkspace(null), session);

    expect(payload.workspace).toBeUndefined();
    expect(payload.workspaceId).toBeUndefined();
    expect(payload.anchors).toBeUndefined();
  });

  test("includes session anchors before workspace anchors", async () => {
    const reviewAnchor = { type: "planner-review", id: "PS-7", label: "PS-7" };
    const ticketAnchor = { type: "ticket", id: "ticket-7", label: "PS-7" };
    const payload = await resolve(depsWithWorkspace({ id: "ws-1", anchors_json: [ticketAnchor] }), {
      ...session,
      anchors_json: [reviewAnchor],
    });

    expect(payload.anchors).toEqual([reviewAnchor, ticketAnchor]);
  });
});
