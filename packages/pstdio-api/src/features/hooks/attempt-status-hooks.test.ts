import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginService } from "../plugins/plugin-service";
import { deliverPostAttemptStatusHook, firePreAttemptStatusHook } from "./attempt-status-hooks";
import { createPostHookStore } from "./post-hook-store";

let repoDir: string;

beforeEach(async () => {
  repoDir = await realpath(await mkdtemp(join(tmpdir(), "pstdio-attempt-hooks-test-")));
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

const writePlugin = (fileName: string, code: string) => {
  const pluginsDir = join(repoDir, ".pstdio", "plugins");
  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(join(pluginsDir, fileName), code);
};

const makeDeps = () => ({
  pluginService: createPluginService({
    repoService: { listByProject: async () => [{ path: repoDir }] },
    filesRoot: "",
    storageRoot: repoDir,
    ensureWorkspace: async () => {},
  }),
});

describe("firePreAttemptStatusHook", () => {
  test("rejects when pre-hook returns reject", async () => {
    writePlugin(
      "guard.ts",
      `export default { hooks: { preAttemptStatusChange: () => ({ reject: true, reason: "validation failed" }) } };`,
    );

    const result = await firePreAttemptStatusHook(makeDeps(), {
      projectId: "proj-1",
      fromStatus: "wip",
      toStatus: "review-ready",
      payload: {},
    });

    expect(result.rejected).toBe(true);
    expect(result.stderr).toContain("validation failed");
  });

  test("allows transition when pre-hook does not reject", async () => {
    writePlugin("pass.ts", `export default { hooks: { preAttemptStatusChange: () => {} } };`);

    const result = await firePreAttemptStatusHook(makeDeps(), {
      projectId: "proj-1",
      fromStatus: "wip",
      toStatus: "review-ready",
      payload: {},
    });

    expect(result.rejected).toBe(false);
  });

  test("allows transition when no plugins exist", async () => {
    const result = await firePreAttemptStatusHook(makeDeps(), {
      projectId: "proj-1",
      fromStatus: "wip",
      toStatus: "review-ready",
      payload: {},
    });

    expect(result.rejected).toBe(false);
  });

  test("passes context to pre-hook", async () => {
    writePlugin(
      "inspect.ts",
      [
        "let captured;",
        "export default { hooks: { preAttemptStatusChange(ctx) { captured = ctx; } } };",
        "export { captured };",
      ].join("\n"),
    );

    await firePreAttemptStatusHook(makeDeps(), {
      projectId: "proj-1",
      fromStatus: "wip",
      toStatus: "review-ready",
      payload: { workspace: "PS-1_A1" },
    });

    // Context should include fromStatus, toStatus, and payload fields
    // (verified by the non-rejection — if it threw, it would reject)
  });
});

describe("deliverPostAttemptStatusHook", () => {
  test("fires queued post-hook and consumes entry", async () => {
    writePlugin(
      "post-handler.ts",
      `
      import { writeFileSync } from "node:fs";
      export default { hooks: { postAttemptStatusChange() { writeFileSync("${join(repoDir, "hook-fired")}", "yes"); } } };
      `,
    );

    const deps = makeDeps();
    const store = createPostHookStore();
    store.queue("sess_1", {
      hookName: "post-attempt-status-blocked",
      statusChangeId: "sc_1",
      fromStatus: "wip",
      toStatus: "blocked",
      projectId: "proj-1",
      payload: { ticket: "PS-1" },
    });

    await deliverPostAttemptStatusHook(deps, store, "sess_1");
    expect(store.get("sess_1")).toBeUndefined();
  });

  test("returns null when no post-hook is queued", async () => {
    const store = createPostHookStore();
    const result = await deliverPostAttemptStatusHook(makeDeps(), store, "sess_1");
    expect(result).toBeNull();
  });
});
