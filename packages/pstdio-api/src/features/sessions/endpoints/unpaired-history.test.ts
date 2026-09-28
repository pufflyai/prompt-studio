import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionMessage } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import { persistSessionMessages } from "../session-messages";

test("a history the harness cannot pair keeps the saved conversation and resumes after it", async () => {
  const root = await mkdtemp(join(tmpdir(), "unpaired-history-"));
  const user: SessionMessage = { id: "user", role: "user", parts: [{ type: "text", text: "First" }] };
  const saved: SessionMessage[] = [
    user,
    { id: "reply", role: "assistant", parts: [{ type: "text", text: "Saved answer" }] },
  ];
  const resumed: { prompt: string; messageOffset?: number }[] = [];
  const record = createTestHarnessRecord("unpaired", {
    provider: {
      getMessages: () => [user],
      recoverMessages: () => ({ kind: "conflict", category: "unpairable" }),
      resume: (_ctx, input) => {
        resumed.push({ prompt: input.prompt, messageOffset: input.messageOffset });
        return { done: Promise.resolve({ status: "completed" as const }), stop: () => {} };
      },
    },
  });
  const handle = await createTestApp({ storageRoot: root, harnessRegistry: createTestHarnessRegistry([record]) });
  try {
    const project = await handle.deps.projectService.create({ name: "Unpaired history" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Unpaired",
      status: "completed",
      agent: testHarnessId("unpaired"),
    });
    await handle.deps.sessionService.update(session.id, { agent_session_id: "thread" });
    await persistSessionMessages(session.id, saved, handle.deps);
    const get = (suffix: string) => handle.app.request(`/v1/sessions/${session.id}/${suffix}`);
    expect(await (await get("conversation")).json()).toEqual(expect.objectContaining({ messages: saved }));
    expect(await (await get("stream")).text()).not.toContain("history_issue");
    const followUp = await handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Continue" }),
    });
    expect(followUp.ok).toBe(true);
    for (let attempt = 0; attempt < 100 && !resumed.length; attempt++) await Bun.sleep(10);
    expect(resumed).toEqual([{ prompt: "Continue", messageOffset: saved.length }]);
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await handle.deps.sessionService.get(session.id))?.status === "completed") break;
      await Bun.sleep(10);
    }
  } finally {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});
