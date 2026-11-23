import { afterEach, beforeEach, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import type { TerminalSessionRequest } from "pstdio-api-contracts";
import { acceptPreparedRevision, prepareExtensionRevision } from "pstdio-extensions";
import { expectRejection } from "../../test-utils/expect-rejection";
import { createWorkspaceContextFixture } from "../extensions/workspace-context.test-fixture";
import { nativeTerminalAttachmentKey, openNativeTerminalSession } from "./native-terminal-session";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
let requests: TerminalSessionRequest[];
let kills: number;
const binding = { projectId: "project-1", viewId: "example.context.view.console", cols: 80, rows: 24 };
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
  requests = [];
  kills = 0;
  await writeFile(
    `${fixture.root}/extension.ts`,
    `export default { views: [{
    id: "console", ref: { kind: "view", id: "console" }, title: "Console", body: {
      kind: "terminal", session: async (ctx, input) => {
        await ctx.storage.set("native-launch-called", true);
        return {
          workspaceId: input.renderer.resource?.id,
          command: ["sh"], env: { PROJECT: ctx.projectId }
        };
      }
    }
  }] };`,
  );
  fixture.deps.terminal = {
    openSession: (request) => {
      requests.push(request);
      return {
        id: "pty",
        write() {},
        resize() {},
        async kill() {
          kills += 1;
        },
        events: async function* () {},
      };
    },
  };
});
afterEach(async () => {
  await fixture.cleanup();
});

test("the callback resolves a project workspace, then the view owns the PTY beyond invocation return", async () => {
  const session = await openNativeTerminalSession(fixture.deps, binding, new AbortController().signal);
  expect(requests).toEqual([{ cols: 80, rows: 24, cwd: fixture.root, command: ["sh"], env: { PROJECT: "project-1" } }]);
  expect(fixture.values.get("native-launch-called")).toBe(true);
  expect(kills).toBe(0);
  await session.kill();
  expect(kills).toBe(1);
});

test("native views reject a resource from another project before invoking it", async () => {
  await expectRejection(
    openNativeTerminalSession(
      fixture.deps,
      { ...binding, resource: { type: "workspace", id: "foreign", projectId: "other" } },
      new AbortController().signal,
    ),
  ).toThrow(/project/i);
  expect(requests).toEqual([]);
  expect(fixture.values.has("native-launch-called")).toBe(false);
});

test("foreground titles preserve a terminal attachment while workspace changes use another attachment", async () => {
  const resource = {
    type: "terminal",
    id: "one",
    projectId: "project-1",
    label: "Terminal 1",
    metadata: { workspaceId: "root" },
  };
  const signal = new AbortController().signal;
  const original = await nativeTerminalAttachmentKey(fixture.deps, { ...binding, resource }, signal);
  expect(
    await nativeTerminalAttachmentKey(fixture.deps, { ...binding, resource: { ...resource, label: "vim" } }, signal),
  ).toBe(original);
  expect(
    await nativeTerminalAttachmentKey(
      fixture.deps,
      { ...binding, resource: { ...resource, metadata: { workspaceId: "other" } } },
      signal,
    ),
  ).not.toBe(original);
});

test("only a terminal view in the enabled project runtime can open a native PTY", async () => {
  await expectRejection(
    openNativeTerminalSession(
      fixture.deps,
      { ...binding, viewId: "other.extension.view.console" },
      new AbortController().signal,
    ),
  ).toThrow(/view/i);
  expect(requests).toEqual([]);
});

for (const change of [
  { project_id: "other" },
  { provider_state: "provisioning" },
  { execution_kind: "remote" },
  { initializing: true },
  { setup_error: "failed" },
  { deleted_at: "deleted" },
]) {
  test(`native workspace authorization rejects ${JSON.stringify(change)}`, async () => {
    Object.assign(fixture.workspace, change);
    await expectRejection(openNativeTerminalSession(fixture.deps, binding, new AbortController().signal)).toThrow(
      /workspace/i,
    );
    expect(requests).toEqual([]);
  });
}

test("closing the view releases the PTY and removing its installed owner releases it too", async () => {
  const abort = new AbortController();
  await openNativeTerminalSession(fixture.deps, binding, abort.signal);
  abort.abort();
  await Bun.sleep(0);
  expect(kills).toBe(1);
  const second = await openNativeTerminalSession(fixture.deps, binding, new AbortController().signal);
  await writeFile(`${fixture.root}/extension.ts`, "export default {};");
  await acceptPreparedRevision(fixture.root, await prepareExtensionRevision(fixture.root));
  fixture.deps.extensionRuntimeCatalog.invalidate({ sourcePath: fixture.root, reason: "source_changed" });
  // Catalog invalidation completion is observable through the same catalog read.
  await fixture.deps.extensionRuntimeCatalog.get(binding.projectId);
  await Bun.sleep(0);
  expect(kills).toBe(2);
  await second.kill();
  expect(kills).toBe(2);
});

test("removing the device copy closes a retained native terminal and refuses reattachment", async () => {
  const session = await openNativeTerminalSession(fixture.deps, binding, new AbortController().signal);
  const work = fixture.deps.projectService.work;
  work.suspend(binding.projectId);
  await work.drain(binding.projectId);
  await work.closeResources(binding.projectId);
  expect(kills).toBe(1);
  await expectRejection(nativeTerminalAttachmentKey(fixture.deps, binding, new AbortController().signal)).toThrow(
    "removing",
  );
  await session.kill();
  expect(kills).toBe(1);
});

test("reloading another contribution retains the enabled terminal owner", async () => {
  const session = await openNativeTerminalSession(fixture.deps, binding, new AbortController().signal);
  const path = `${fixture.root}/extension.ts`;
  const source = await Bun.file(path).text();
  await writeFile(path, source.replace('title: "Console"', 'title: "Localized console"'));
  await acceptPreparedRevision(fixture.root, await prepareExtensionRevision(fixture.root));
  fixture.deps.extensionRuntimeCatalog.invalidate({ sourcePath: fixture.root, reason: "source_changed" });
  await fixture.deps.extensionRuntimeCatalog.get(binding.projectId);
  await Bun.sleep(0);
  expect(kills).toBe(0);
  await session.kill();
  expect(kills).toBe(1);
});

test("replacing the enabled installed instance releases its existing terminal", async () => {
  const session = await openNativeTerminalSession(fixture.deps, binding, new AbortController().signal);
  fixture.source.instance = { ...fixture.source.instance, id: "replacement-instance" };
  fixture.deps.extensionRuntimeCatalog.invalidate({ sourcePath: fixture.root, reason: "enablement_changed" });
  await fixture.deps.extensionRuntimeCatalog.get(binding.projectId);
  await Bun.sleep(0);
  expect(kills).toBe(1);
  await session.kill();
  expect(kills).toBe(1);
});

test("copy removal waits for an already closing terminal to finish its process cleanup", async () => {
  const stopped = Promise.withResolvers<void>();
  const exiting = Promise.withResolvers<void>();
  const exitObserved = Promise.withResolvers<void>();
  fixture.deps.terminal!.openSession = () => ({
    id: "closing-pty",
    write() {},
    resize() {},
    async kill() {
      kills++;
      exiting.resolve();
      await stopped.promise;
    },
    events: async function* () {
      await exiting.promise;
      yield { kind: "exit", code: 0, signal: null };
      exitObserved.resolve();
    },
  });
  const session = await openNativeTerminalSession(fixture.deps, binding, new AbortController().signal);
  const events = (async () => {
    for await (const event of session.events()) expect(event.kind).toBe("exit");
  })();
  const closing = session.kill();
  await exitObserved.promise;
  await events;
  fixture.deps.projectService.work.suspend(binding.projectId);
  let cleanupFinished = false;
  const cleanup = fixture.deps.projectService.work.closeResources(binding.projectId).then(() => {
    cleanupFinished = true;
  });
  try {
    await Bun.sleep(0);
    expect(cleanupFinished).toBe(false);
  } finally {
    stopped.resolve();
    await Promise.all([closing, cleanup]);
  }
  expect(kills).toBe(1);
});
