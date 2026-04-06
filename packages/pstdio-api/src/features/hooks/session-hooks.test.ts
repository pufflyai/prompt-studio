import { describe, expect, test } from "bun:test";
import type { SessionHookDeps } from "./session-hooks";
import { fireSessionResumeHook, fireSessionStartHook, fireSessionStatusHook } from "./session-hooks";

const baseWorkspace = {
  id: "ws-1",
  project_id: "proj-1",
  name: "Workspace 1",
  branch: "workspace/PS-1_A1",
  worktree_path: "/tmp/ws-1",
  attempt_status_id: "attempt-review-ready",
  archived: false,
  workspace_shorthand: "PS-1_A1",
  startup_log_file_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  initializing: false,
  setup_error: null,
};

const baseTicket = {
  id: "ticket-1",
  shorthand: "PS-1",
  project_id: "proj-1",
  status_id: "status-wip",
  display_title: "Implement feature",
  user_prompt: "Do the thing",
  file_id: "file-1",
  parent_id: null,
  parallelizable: null,
  blocked_reason: null,
  depends_on: null,
  draft: false,
  archived: false,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

type CapturedCall = {
  hookName: string;
  ctx: Record<string, unknown>;
};

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
};

const makeDeps = (input?: {
  workspace?: Record<string, unknown> | null;
  getWorkspaceBySessionId?: () => Promise<Record<string, unknown> | null>;
  ticket?: Record<string, unknown> | null;
  attemptStatuses?: Array<{ id: string; name: string }>;
  statuses?: Array<{ id: string; name: string }>;
}) => {
  const pending: Array<{ resolve: (value: CapturedCall) => void }> = [];
  const calls: CapturedCall[] = [];

  const nextCall = () => {
    const deferred = createDeferred<CapturedCall>();
    pending.push({ resolve: deferred.resolve });
    return deferred.promise;
  };

  const workspace = input?.workspace ?? null;
  const ticket = input?.ticket ?? null;
  const attemptStatuses = input?.attemptStatuses ?? [];
  const statuses = input?.statuses ?? [];

  const deps: SessionHookDeps = {
    reposService: { listByProject: async () => [] } as never,
    workspaceSessionsService: {
      getWorkspaceBySessionId: input?.getWorkspaceBySessionId ?? (async () => workspace),
    } as never,
    attemptStatusesService: {
      list: async () => attemptStatuses,
    } as never,
    ticketService: {
      getByShorthand: async () => ticket,
    } as never,
    statusService: {
      list: async () => statuses,
    } as never,
    pluginService: {
      getForProject: async () => ({
        hooks: {
          firePre: async () => ({ rejected: false }),
          firePost: async (hookName: string, ctx: unknown) => {
            const call = { hookName, ctx: ctx as Record<string, unknown> };
            calls.push(call);
            pending.shift()?.resolve(call);
          },
        },
        client: {},
      }),
    } as never,
  };

  return { deps, nextCall, calls };
};

const sessionBase = {
  id: "sess_1",
  project_id: "proj-1",
};

describe("fireSessionStatusHook", () => {
  test("includes workspace and ticket objects for postSessionSuccess", async () => {
    const { deps, nextCall } = makeDeps({
      workspace: baseWorkspace,
      ticket: baseTicket,
      attemptStatuses: [{ id: "attempt-review-ready", name: "review-ready" }],
      statuses: [{ id: "status-wip", name: "wip" }],
    });

    const call = nextCall();
    fireSessionStatusHook(deps, { ...sessionBase, status: "completed" });

    const { hookName, ctx } = await call;
    expect(hookName).toBe("postSessionSuccess");
    expect(ctx.workspace).toEqual({
      ...baseWorkspace,
      ticket_shorthand: "PS-1",
      attempt_status_name: "review-ready",
    });
    expect(ctx.workspaceId).toBe("ws-1");
    expect(ctx.ticket).toEqual({ ...baseTicket, status_name: "wip" });
    expect(ctx.attemptStatus).toBe("review-ready");
  });

  test("includes workspace and ticket objects for postSessionFail", async () => {
    const { deps, nextCall } = makeDeps({ workspace: baseWorkspace, ticket: baseTicket });

    const call = nextCall();
    fireSessionStatusHook(deps, { ...sessionBase, status: "failed" });

    const { hookName, ctx } = await call;
    expect(hookName).toBe("postSessionFail");
    expect(ctx.workspace).toEqual({
      ...baseWorkspace,
      ticket_shorthand: "PS-1",
      attempt_status_name: null,
    });
    expect(ctx.ticket).toEqual({ ...baseTicket, status_name: null });
  });

  test("includes workspace and ticket objects for postSessionAwaitInput", async () => {
    const { deps, nextCall } = makeDeps({ workspace: baseWorkspace, ticket: baseTicket });

    const call = nextCall();
    fireSessionStatusHook(deps, { ...sessionBase, status: "awaiting_input" });

    const { hookName, ctx } = await call;
    expect(hookName).toBe("postSessionAwaitInput");
    expect(ctx.workspace).toEqual({
      ...baseWorkspace,
      ticket_shorthand: "PS-1",
      attempt_status_name: null,
    });
    expect(ctx.ticket).toEqual({ ...baseTicket, status_name: null });
  });

  test("does not fire for in_progress", async () => {
    const { deps, calls } = makeDeps();

    fireSessionStatusHook(deps, { ...sessionBase, status: "in_progress" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls).toHaveLength(0);
  });
});

describe("fireSessionStartHook", () => {
  test("includes workspace and ticket objects when available", async () => {
    const { deps, nextCall } = makeDeps({ workspace: baseWorkspace, ticket: baseTicket });

    const call = nextCall();
    fireSessionStartHook(deps, { ...sessionBase, status: "in_progress" });

    const { hookName, ctx } = await call;
    expect(hookName).toBe("postSessionStart");
    expect(ctx.workspace).toEqual({
      ...baseWorkspace,
      ticket_shorthand: "PS-1",
      attempt_status_name: null,
    });
    expect(ctx.ticket).toEqual({ ...baseTicket, status_name: null });
  });

  test("waits for linked workspace setup to finish before firing", async () => {
    let workspace = { ...baseWorkspace, initializing: true };
    const { deps, calls, nextCall } = makeDeps({
      getWorkspaceBySessionId: async () => workspace,
      ticket: baseTicket,
    });

    const call = nextCall();
    fireSessionStartHook(deps, { ...sessionBase, status: "in_progress" });

    await Bun.sleep(10);
    expect(calls).toHaveLength(0);

    workspace = { ...baseWorkspace, initializing: false };
    const { ctx } = await call;
    expect(ctx.workspace).toEqual({
      ...baseWorkspace,
      ticket_shorthand: "PS-1",
      attempt_status_name: null,
    });
  });

  test("omits workspace and ticket objects when session has no linked workspace", async () => {
    const { deps, nextCall } = makeDeps();

    const call = nextCall();
    fireSessionStartHook(deps, { ...sessionBase, status: "in_progress" });

    const { ctx } = await call;
    expect(ctx.workspace).toBeUndefined();
    expect(ctx.workspaceId).toBeUndefined();
    expect(ctx.ticket).toBeUndefined();
  });
});

describe("fireSessionResumeHook", () => {
  test("includes workspace and ticket objects when available", async () => {
    const { deps, nextCall } = makeDeps({ workspace: baseWorkspace, ticket: baseTicket });

    const call = nextCall();
    fireSessionResumeHook(deps, {
      ...sessionBase,
      status: "in_progress",
    });

    const { hookName, ctx } = await call;
    expect(hookName).toBe("postSessionResume");
    expect(ctx.workspace).toEqual({
      ...baseWorkspace,
      ticket_shorthand: "PS-1",
      attempt_status_name: null,
    });
    expect(ctx.ticket).toEqual({ ...baseTicket, status_name: null });
  });

  test("waits for linked workspace setup to finish before firing", async () => {
    let workspace = { ...baseWorkspace, initializing: true };
    const { deps, calls, nextCall } = makeDeps({
      getWorkspaceBySessionId: async () => workspace,
      ticket: baseTicket,
    });

    const call = nextCall();
    fireSessionStatusHook(deps, { ...sessionBase, status: "completed" });

    await Bun.sleep(10);
    expect(calls).toHaveLength(0);

    workspace = { ...baseWorkspace, initializing: false };
    const { hookName, ctx } = await call;
    expect(hookName).toBe("postSessionSuccess");
    expect(ctx.workspace).toEqual({
      ...baseWorkspace,
      ticket_shorthand: "PS-1",
      attempt_status_name: null,
    });
  });
});
