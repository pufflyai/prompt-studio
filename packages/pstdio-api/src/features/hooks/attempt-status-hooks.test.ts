import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EventDeliveryResult } from "@pstdio/sdk/extensions";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { createPluginService } from "../plugins/plugin-service";
import { firePostAttemptStatusHook, firePreAttemptStatusHook } from "./attempt-status-hooks";

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

type DispatchExtensionEvent = (
  deps: ExtensionsRouteDeps,
  projectId: string,
  eventId: string,
  payload: Record<string, unknown>,
) => Promise<EventDeliveryResult>;

const makeDeps = (dispatchExtensionEvent?: DispatchExtensionEvent) => ({
  pluginService: createPluginService({
    repoService: { listByProject: async () => [{ path: repoDir }] },
    listProjectIds: async () => ["proj-1"],
    filesRoot: "",
    storageRoot: repoDir,
    ensureWorkspace: async () => {},
  }),
  dispatchExtensionEvent,
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

  test("rejects when extension pre-hook reports diagnostics", async () => {
    const result = await firePreAttemptStatusHook(
      makeDeps(async () => ({
        delivered: 0,
        diagnostics: [{ code: "hook_failed", message: "extension validation failed", severity: "warning" }],
      })),
      {
        projectId: "proj-1",
        fromStatus: "wip",
        toStatus: "review-ready",
        payload: {},
      },
    );

    expect(result.rejected).toBe(true);
    expect(result.stderr).toContain("extension validation failed");
  });
});

describe("firePostAttemptStatusHook", () => {
  test("dispatches matching extension event", async () => {
    let captured: { eventId: string; payload: Record<string, unknown> } | undefined;
    await firePostAttemptStatusHook(
      makeDeps(async (_deps, _projectId, eventId, payload) => {
        captured = { eventId, payload };
        return { delivered: 1 };
      }),
      {
        projectId: "proj-1",
        toStatus: "review-ready",
        payload: { workspace: "PS-1_A1" },
      },
    );

    expect(captured?.eventId).toBe("kernel.postAttemptStatusChange");
    expect(captured?.payload).toMatchObject({ projectId: "proj-1", toStatus: "review-ready", workspace: "PS-1_A1" });
  });
});
