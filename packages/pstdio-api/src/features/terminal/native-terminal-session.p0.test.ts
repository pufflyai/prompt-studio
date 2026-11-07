import { afterEach, beforeEach, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import type { TerminalSessionRequest } from "pstdio-api-contracts";
import { createWorkspaceContextFixture } from "../extensions/workspace-context.test-fixture";
import { openNativeTerminalSession } from "./native-terminal-session";

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
      kind: "terminal", session: async (ctx, input) => ({
        workspaceId: input.renderer.resource?.id,
        command: ["sh"], env: { PROJECT: ctx.projectId }
      })
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
  expect(kills).toBe(0);
  await session.kill();
  expect(kills).toBe(1);
});

test("native views reject a resource from another project before invoking it", async () => {
  await expect(
    openNativeTerminalSession(
      fixture.deps,
      { ...binding, resource: { type: "workspace", id: "foreign", projectId: "other" } },
      new AbortController().signal,
    ),
  ).rejects.toThrow(/project/i);
  expect(requests).toEqual([]);
});

test("only a terminal view in the enabled project runtime can open a native PTY", async () => {
  await expect(
    openNativeTerminalSession(
      fixture.deps,
      { ...binding, viewId: "other.extension.view.console" },
      new AbortController().signal,
    ),
  ).rejects.toThrow(/view/i);
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
    await expect(openNativeTerminalSession(fixture.deps, binding, new AbortController().signal)).rejects.toThrow(
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
  fixture.deps.extensionRuntimeCatalog.invalidate({ sourcePath: fixture.root, reason: "source_changed" });
  // Catalog invalidation completion is observable through the same catalog read.
  await fixture.deps.extensionRuntimeCatalog.get(binding.projectId);
  await Bun.sleep(0);
  expect(kills).toBe(2);
  await second.kill();
  expect(kills).toBe(2);
});
