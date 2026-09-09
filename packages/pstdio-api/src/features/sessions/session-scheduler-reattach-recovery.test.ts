import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessExit, HarnessSession } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";

const pendingSession = (agentSessionId: string): HarnessSession => {
  const exit = Promise.withResolvers<HarnessExit>();
  return {
    agentSessionId,
    done: exit.promise,
    stop: () => exit.resolve({ status: "cancelled" }),
    timeoutStrategy: "provider",
  };
};

describe("session scheduler reattach recovery", () => {
  test.each([true, false])("recovers claimed follow-ups before orphan reattach (claimed: %s)", async (claimed) => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-queue-reattach-"));
    const databasePath = join(root, "db");
    const storageRoot = join(root, "storage");
    const resumed: string[] = [];
    const reattached: string[] = [];
    const registry = () =>
      createTestHarnessRegistry([
        createTestHarnessRecord("opencode", {
          provider: {
            capabilities: () => ["SessionReattach"],
            start: () => pendingSession("new-session"),
            resume: (_ctx, input) => {
              resumed.push(input.prompt);
              return pendingSession(input.agentSessionId);
            },
            reattach: (_ctx, input) => {
              reattached.push(input.agentSessionId);
              return pendingSession(input.agentSessionId);
            },
          },
        }),
      ]);
    const first = await createTestApp({ databasePath, storageRoot, harnessRegistry: registry() });
    let sessionId = "";
    try {
      const project = await first.deps.projectService.create({ name: "Queue recovery" });
      const session = await first.deps.sessionService.create({
        project_id: project.id,
        agent: testHarnessId("opencode"),
        cwd: root,
        title: "Existing session",
      });
      sessionId = session.id;
      await first.deps.sessionService.update(session.id, { agent_session_id: "previous-provider-session" });
      if (claimed) {
        const queued = await first.deps.sessionService.queueExistingWithEntry({
          id: session.id,
          prompt: "accepted follow-up",
          request_kind: "follow_up",
        });
        await first.deps.sessionService.claimQueuedForDispatch(session.id, queued!.entry!.queue_position);
      }
    } finally {
      await first.close();
    }
    const recovered = await createTestApp({ databasePath, storageRoot, harnessRegistry: registry() });
    try {
      for (let attempt = 0; attempt < 40 && resumed.length + reattached.length === 0; attempt += 1) await Bun.sleep(25);
      if (claimed) {
        expect(resumed).toEqual(["accepted follow-up"]);
        expect(reattached).toEqual([]);
      } else {
        expect(reattached).toEqual(["previous-provider-session"]);
        expect(resumed).toEqual([]);
      }
      expect(await recovered.deps.sessionQueueEntriesService.listPendingBySession(sessionId)).toEqual([]);
      expect(await recovered.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);
      expect(recovered.deps.sessionService.store.get(sessionId)).not.toBeNull();
    } finally {
      await recovered.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
