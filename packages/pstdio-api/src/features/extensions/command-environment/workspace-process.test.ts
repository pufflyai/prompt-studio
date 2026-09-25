import { afterEach, beforeEach, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import type { TerminalSessionRequest } from "pstdio-api-contracts/extension-kernel";
import { createInvocationScope } from "pstdio-extensions";
import { createWorkspaceContextFixture } from "../workspace-context.test-fixture";
import { createCommandEnvironment } from "./index";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
let requests: TerminalSessionRequest[];
let writes: (string | Uint8Array)[];
let sizes: number[][];
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
  requests = [];
  writes = [];
  sizes = [];
  fixture.deps.terminal = {
    openSession(request) {
      requests.push(request);
      return {
        id: "host-session",
        write: (data) => {
          writes.push(data);
        },
        resize: (cols, rows) => {
          sizes.push([cols, rows]);
        },
        kill: async () => {},
        events: async function* () {
          yield { kind: "exit", code: 0, signal: null };
        },
      };
    },
  };
});
afterEach(async () => {
  await fixture.cleanup();
});

const environment = (workspaceId: string | undefined = fixture.workspace.id, eventId?: string) =>
  createCommandEnvironment(fixture.deps, [fixture.source] as never, {
    project: { id: "project-1", name: "Project", shorthand: "P" },
    projectId: "project-1",
    extensionId: "example.context",
    name: "context",
    workspaceId,
    eventId,
  });
const command = [process.execPath, "-e", "console.log(process.cwd())"];
const terminalRequest = { cols: 80, rows: 24 };
const events = async (session: ReturnType<NonNullable<ReturnType<typeof environment>["terminal"]>["openSession"]>) => {
  const received = [];
  for await (const event of session.events()) received.push(event);
  return received;
};

test("processes and terminals default to the selected workspace directory", async () => {
  const env = environment();
  expect((await env.process.run({ command })).stdout.trim()).toBe(fixture.root);
  const session = env.terminal!.openSession(terminalRequest);
  session.write("queued input");
  session.resize(100, 30);
  await events(session);
  expect(requests).toEqual([{ ...terminalRequest, cwd: fixture.root }]);
  expect(writes).toEqual(["queued input"]);
  expect(sizes).toEqual([[100, 30]]);
});

test("local targets may explicitly choose another directory", async () => {
  const env = environment();
  const result = await env.process.run({ command, cwd: tmpdir() });
  expect(result.exitCode).toBe(0);
  await events(env.terminal!.openSession({ ...terminalRequest, cwd: tmpdir() }));
  expect(requests[0]?.cwd).toBe(tmpdir());
});

for (const change of [
  { execution_kind: "remote" },
  { provider_state: "provisioning" },
  { initializing: true },
  { setup_error: "failed" },
  { project_id: "other" },
  { deleted_at: "2026-01-01" },
]) {
  test(`processes and terminals recheck workspace availability: ${JSON.stringify(change)}`, async () => {
    const env = environment();
    Object.assign(fixture.workspace, change);
    await expect(env.process.run({ command, cwd: fixture.root })).rejects.toThrow("local process target");
    await expect(env.process.spawnDetached({ command, cwd: fixture.root })).rejects.toThrow("local process target");
    expect(await events(env.terminal!.openSession({ ...terminalRequest, cwd: fixture.root }))).toEqual([
      { kind: "error", message: expect.stringContaining("local process target") },
      { kind: "exit", code: null, signal: null },
    ]);
    expect(requests).toEqual([]);
  });
}

test("trusted provision hooks can repair their own initializing workspace", async () => {
  Object.assign(fixture.workspace, { initializing: true, setup_error: "retrying" });
  const env = environment(fixture.workspace.id, "workspace.provision");
  expect((await env.process.run({ command })).stdout.trim()).toBe(fixture.root);
  await events(env.terminal!.openSession(terminalRequest));
  expect(requests[0]?.cwd).toBe(fixture.root);
});

test("ending an invocation before target resolution never opens a terminal", async () => {
  let resolveWorkspace!: () => void;
  const waiting = new Promise<void>((resolve) => {
    resolveWorkspace = resolve;
  });
  fixture.deps.workspaceService.get = async () => {
    await waiting;
    return fixture.workspace as never;
  };
  const scope = createInvocationScope({ logger: { info() {}, warn() {}, error() {} } });
  const scoped = environment().withScope!(scope);
  const session = scoped.terminal!.openSession(terminalRequest);
  const disposing = scope.close();
  resolveWorkspace();
  await disposing;
  expect(await events(session)).toEqual([{ kind: "exit", code: null, signal: null }]);
  expect(requests).toEqual([]);
});

test("legacy environments without a workspace preserve their unscoped terminal", async () => {
  const env = environment("");
  await events(env.terminal!.openSession(terminalRequest));
  expect(requests).toEqual([terminalRequest]);
});

test("closing an invocation during process target resolution prevents a late spawn", async () => {
  let resolveWorkspace!: () => void;
  const waiting = new Promise<void>((resolve) => {
    resolveWorkspace = resolve;
  });
  fixture.deps.workspaceService.get = async () => {
    await waiting;
    return fixture.workspace as never;
  };
  const scope = createInvocationScope({ logger: { info() {}, warn() {}, error() {} } });
  const pending = environment().withScope!(scope).process.run({ command });
  await scope.close();
  resolveWorkspace();
  await expect(pending).rejects.toThrow("Invocation ended");
});
