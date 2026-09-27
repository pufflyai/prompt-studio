import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TerminalSessionRequest } from "pstdio-api-contracts/extension-kernel";
import { createInvocationScope } from "pstdio-extensions";
import { createCommandEnvironment } from "./index";

let root: string;
let workspace: ReturnType<typeof localWorkspace>;
let requests: TerminalSessionRequest[];
let writes: (string | Uint8Array)[];
let sizes: number[][];
const localWorkspace = (root: string) => ({
  id: "home",
  project_id: "project",
  root_path: root,
  execution_kind: "local",
  provider_state: "ready",
  initializing: false,
  setup_error: null as string | null,
  deleted_at: null as string | null,
});
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "workspace-terminal-")));
  workspace = localWorkspace(root);
  requests = [];
  writes = [];
  sizes = [];
});
afterEach(() => rm(root, { recursive: true, force: true }));
const environment = (eventId?: string, get = async () => workspace) =>
  createCommandEnvironment(
    {
      workspaceService: { get, getDefault: get },
      terminal: {
        openSession(request: TerminalSessionRequest) {
          requests.push(request);
          return {
            id: "host",
            write: (data: string | Uint8Array) => {
              writes.push(data);
            },
            resize: (cols: number, rows: number) => {
              sizes.push([cols, rows]);
            },
            kill: async () => {},
            events: async function* () {
              yield { kind: "exit", code: 0, signal: null };
            },
          };
        },
      },
    } as never,
    [{ instance: { id: "instance" }, installedSource: { extension_id: "example.tools", source_path: root } }] as never,
    {
      project: { id: "project", name: "Project", shorthand: "P" },
      projectId: "project",
      extensionId: "example.tools",
      name: "tools",
      workspaceId: workspace.id,
      workspaceDir: root,
      eventId,
    },
  );
const request = { cols: 80, rows: 24 };
const events = async (session: ReturnType<NonNullable<ReturnType<typeof environment>["terminal"]>["openSession"]>) => {
  const received = [];
  for await (const event of session.events()) received.push(event);
  return received;
};

test("terminals resolve the current workspace directory before opening and preserve early input", async () => {
  const env = environment();
  workspace.root_path = join(root, "moved");
  const session = env.terminal!.openSession(request);
  session.write("queued input");
  session.resize(100, 30);
  await events(session);
  expect(requests).toEqual([{ ...request, cwd: workspace.root_path }]);
  expect(writes).toEqual(["queued input"]);
  expect(sizes).toEqual([[100, 30]]);
});

test("a local terminal may use an explicit working directory", async () => {
  await events(environment().terminal!.openSession({ ...request, cwd: tmpdir() }));
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
  test(`terminals recheck workspace availability: ${JSON.stringify(change)}`, async () => {
    const env = environment();
    Object.assign(workspace, change);
    expect(await events(env.terminal!.openSession({ ...request, cwd: root }))).toEqual([
      { kind: "error", message: expect.stringContaining("local process target") },
      { kind: "exit", code: null, signal: null },
    ]);
    expect(requests).toEqual([]);
  });
}

test("trusted provision hooks can open a terminal to repair their own workspace", async () => {
  Object.assign(workspace, { initializing: true, setup_error: "retrying" });
  await events(environment("workspace.provision").terminal!.openSession(request));
  expect(requests[0]?.cwd).toBe(root);
});

test("closing an invocation while resolving its target never starts a terminal", async () => {
  let resolveWorkspace!: () => void;
  const waiting = new Promise<void>((resolve) => {
    resolveWorkspace = resolve;
  });
  const env = environment(undefined, async () => {
    await waiting;
    return workspace;
  });
  const scope = createInvocationScope({ logger: { info() {}, warn() {}, error() {} } });
  const session = env.withScope!(scope).terminal!.openSession(request);
  const closing = scope.close();
  resolveWorkspace();
  await closing;
  expect(await events(session)).toEqual([{ kind: "exit", code: null, signal: null }]);
  expect(requests).toEqual([]);
});
