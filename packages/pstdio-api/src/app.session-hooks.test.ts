import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestHarnessRegistry } from "./features/harnesses/test-harness-registry";
import { createTestApp } from "./test-utils/create-test-app";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let tempRoot: string;

const writeSessionHookExtension = () => {
  const root = join(tempRoot, "session-hook-extension");
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "session-hook-extension",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
      type: "module",
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `
      export default {
        hooks: [
          {
            id: "remember-session-started",
            ref: { kind: "hook", id: "remember-session-started" },
            event: { extensionId: "pstdio", kind: "event", id: "session.started" },
            async run(ctx, event) {
              await ctx.storage.set("session.started", {
                eventId: "session.started",
                projectId: event.projectId,
                sessionId: event.sessionId,
                sessionStatus: event.sessionStatus,
              });
            },
          },
          {
            id: "remember-session-awaiting-input",
            ref: { kind: "hook", id: "remember-session-awaiting-input" },
            event: { extensionId: "pstdio", kind: "event", id: "session.awaitingInput" },
            async run(ctx, event) {
              await ctx.storage.set("session.awaitingInput", {
                eventId: "session.awaitingInput",
                projectId: event.projectId,
                sessionId: event.sessionId,
                sessionStatus: event.sessionStatus,
              });
            },
          },
          {
            id: "remember-session-resumed",
            ref: { kind: "hook", id: "remember-session-resumed" },
            event: { extensionId: "pstdio", kind: "event", id: "session.resumed" },
            async run(ctx, event) {
              await ctx.storage.set("session.resumed", {
                eventId: "session.resumed",
                projectId: event.projectId,
                sessionId: event.sessionId,
                sessionStatus: event.sessionStatus,
              });
            },
          },
          {
            id: "remember-session-failed",
            ref: { kind: "hook", id: "remember-session-failed" },
            event: { extensionId: "pstdio", kind: "event", id: "session.failed" },
            async run(ctx, event) {
              await ctx.storage.set("session.failed", {
                eventId: "session.failed",
                projectId: event.projectId,
                sessionId: event.sessionId,
                sessionStatus: event.sessionStatus,
              });
            },
          },
          {
            id: "remember-session-succeeded",
            ref: { kind: "hook", id: "remember-session-succeeded" },
            event: { extensionId: "pstdio", kind: "event", id: "session.succeeded" },
            async run(ctx, event) {
              await ctx.storage.set("session.succeeded", {
                eventId: "session.succeeded",
                projectId: event.projectId,
                sessionId: event.sessionId,
                sessionStatus: event.sessionStatus,
              });
            },
          },
        ],
      };
    `,
  );
  return root;
};

const waitForStoredEvent = async (extensionInstanceId: string, projectId: string, key: string) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const row = await handle.deps.extensionStorageService.getKv(
      { extension_instance_id: extensionInstanceId, scope_type: "project", scope_id: projectId },
      key,
    );
    if (row) return row.value_json;
    await Bun.sleep(20);
  }

  throw new Error(`Session lifecycle hook did not store ${key}`);
};

beforeEach(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-session-hooks-"));
  handle = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    buildWebviews: false,
    harnessRegistry: createTestHarnessRegistry([]),
  });
});

afterEach(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("session lifecycle extension hooks", () => {
  test("dispatches status transition events to enabled extension hooks", async () => {
    const project = await handle.deps.projectService.create({ name: "Hooked Project" });
    const sourcePath = writeSessionHookExtension();
    const enabled = await handle.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "session-hook-extension",
      extensionId: "pstdio.session-hook-extension",
      name: "session-hook-extension",
      displayName: "Session Hook Extension",
      version: "1.0.0",
      sourceKind: "local_path",
      sourcePath,
      manifest: { id: "pstdio.session-hook-extension" },
    });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Hooked session",
      agent: "test-agent",
    });

    await expect(waitForStoredEvent(enabled.instance.id, project.id, "session.started")).resolves.toEqual({
      eventId: "session.started",
      projectId: project.id,
      sessionId: session.id,
      sessionStatus: "in_progress",
    });

    await handle.deps.sessionService.transitionStatus(session.id, "awaiting_input", { drainCapacity: false });

    await expect(waitForStoredEvent(enabled.instance.id, project.id, "session.awaitingInput")).resolves.toEqual({
      eventId: "session.awaitingInput",
      projectId: project.id,
      sessionId: session.id,
      sessionStatus: "awaiting_input",
    });

    await handle.deps.sessionService.resume(session.id);

    await expect(waitForStoredEvent(enabled.instance.id, project.id, "session.resumed")).resolves.toEqual({
      eventId: "session.resumed",
      projectId: project.id,
      sessionId: session.id,
      sessionStatus: "in_progress",
    });

    await handle.deps.sessionService.transitionStatus(session.id, "failed", { drainCapacity: false });

    await expect(waitForStoredEvent(enabled.instance.id, project.id, "session.failed")).resolves.toEqual({
      eventId: "session.failed",
      projectId: project.id,
      sessionId: session.id,
      sessionStatus: "failed",
    });

    const completedSession = await handle.deps.sessionService.create(
      { project_id: project.id, title: "Completed hook session", agent: "test-agent" },
      { emitStartedHook: false },
    );

    await handle.deps.sessionService.transitionStatus(completedSession.id, "completed", { drainCapacity: false });

    await expect(waitForStoredEvent(enabled.instance.id, project.id, "session.succeeded")).resolves.toEqual({
      eventId: "session.succeeded",
      projectId: project.id,
      sessionId: completedSession.id,
      sessionStatus: "completed",
    });
  });
});
