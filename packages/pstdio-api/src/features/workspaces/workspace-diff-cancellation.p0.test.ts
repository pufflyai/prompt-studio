import { expect, spyOn, test } from "bun:test";
import * as childProcess from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { git } from "pstdio-wt";
import type { AppBindings } from "../../types";
import { createWorkspacePresentationApi } from "../extensions/command-environment/workspace-presentation";
import { getWorkspaceDiffSummaryHandler, getWorkspaceDiffSummaryRoute } from "./endpoints/get-workspace-diff-summary";

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-diff-cancellation-"));
  await git(root, ["init"]);
  await git(root, [
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "commit",
    "--allow-empty",
    "-m",
    "Initial",
  ]);
  const workspace = {
    id: "workspace",
    project_id: "project",
    root_path: root,
    execution_kind: "local",
    provider_id: "pstdio.worktree",
    provider_state: "ready",
    initializing: false,
    provider_capabilities_json: { diff: true },
    deleted_at: null,
    setup_error: null,
  };
  const deps = { workspaceService: { get: async () => workspace } } as never;
  const app = new OpenAPIHono<AppBindings>();
  app.onError((error, c) => {
    if (c.req.raw.signal.aborted) return new Response("Read cancelled", { status: 499 });
    throw error;
  });
  app.openapi(getWorkspaceDiffSummaryRoute, getWorkspaceDiffSummaryHandler(deps));
  return {
    root,
    app,
    commands: (signal: AbortSignal) => createWorkspacePresentationApi(deps, { projectId: "project", signal }),
    close: () => rm(root, { recursive: true, force: true }),
  };
};

test.each([
  "HTTP",
  "extension command",
])("cancelling a %s summary stops its admitted Git reader and permits an independent next read", async (surface) => {
  const current = await fixture();
  const abort = new AbortController();
  const held = Promise.withResolvers<childProcess.ChildProcess>();
  let closed: Promise<void> | undefined;
  let childClosed = false;
  const original = childProcess.execFile;
  const intercept = spyOn(childProcess, "execFile").mockImplementation(
    Object.assign((...args: Parameters<typeof original>) => {
      const invocation = [...args];
      if (Array.isArray(invocation[1]) && invocation[1][0] === "diff" && invocation[1].includes("--numstat")) {
        // A real Git process blocks on its open input. No fabricated failure or result.
        invocation[1] = ["hash-object", "--stdin"];
        const child = Reflect.apply(original, childProcess, invocation) as childProcess.ChildProcess;
        closed = new Promise((resolve) =>
          child.once("close", () => {
            childClosed = true;
            resolve();
          }),
        );
        held.resolve(child);
        return child;
      }
      return Reflect.apply(original, childProcess, invocation);
    }, original),
  );
  const response =
    surface === "HTTP"
      ? Promise.resolve(
          current.app.request(
            new Request("http://test/workspaces/workspace/diff-summary?mode=current", { signal: abort.signal }),
          ),
        ).then((reply) => {
          if (reply.status === 499) throw abort.signal.reason;
          return reply.json();
        })
      : current.commands(abort.signal).diffSummary("workspace", "current");
  void response.catch(() => {});
  let child: childProcess.ChildProcess | undefined;
  try {
    child = await held.promise;
    expect(child.exitCode).toBeNull();
    expect(child.stdin?.writable).toBe(true);
    expect(() => process.kill(child!.pid!, 0)).not.toThrow();
    abort.abort();
    expect(child.killed).toBe(true);
    await expect(response).rejects.toBe(abort.signal.reason);
    expect(childClosed).toBe(true);
  } finally {
    if (child && !child.killed) child.stdin?.end();
    await response.catch(() => {});
    await closed;
    intercept.mockRestore();
    try {
      if (child?.pid) expect(() => process.kill(child!.pid!, 0)).toThrow();
      await writeFile(join(current.root, "independent.txt"), "A new line\n");
      const next = await current.app.request("http://test/workspaces/workspace/diff-summary?mode=current");
      expect(next.status).toBe(200);
      expect(await next.json()).toEqual({ workspace_id: "workspace", additions: 1, deletions: 0, file_count: 1 });
    } finally {
      await current.close();
    }
  }
});

test.each(["current", "fork_point"])("an already cancelled %s summary never admits Git work", async (mode) => {
  const current = await fixture();
  const abort = new AbortController();
  abort.abort();
  const original = childProcess.execFile;
  const calls: unknown[] = [];
  const intercept = spyOn(childProcess, "execFile").mockImplementation(
    Object.assign((...args: Parameters<typeof original>) => {
      calls.push(args);
      return Reflect.apply(original, childProcess, args);
    }, original),
  );
  try {
    const response = await current.app.request(
      new Request(`http://test/workspaces/workspace/diff-summary?mode=${mode}`, { signal: abort.signal }),
    );
    expect(calls).toHaveLength(0);
    expect(response.status).toBe(499);
  } finally {
    intercept.mockRestore();
    await current.close();
  }
});
