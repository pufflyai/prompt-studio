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

test("conflicting history remains readable and rejects resume without changing either source", async () => {
  const root = await mkdtemp(join(tmpdir(), "history-conflict-"));
  const user: SessionMessage = { id: "user", role: "user", parts: [{ type: "text", text: "First" }] };
  const saved: SessionMessage[] = [
    user,
    { id: "reply", role: "assistant", parts: [{ type: "text", text: "Saved answer" }] },
  ];
  const native: SessionMessage[] = [
    user,
    { id: "reply", role: "assistant", parts: [{ type: "text", text: "Different answer" }] },
  ];
  let resumed = false;
  const record = createTestHarnessRecord("conflict", {
    provider: {
      getMessages: () => native,
      resume: () => {
        resumed = true;
        throw new Error("Must not resume");
      },
    },
  });
  const handle = await createTestApp({ storageRoot: root, harnessRegistry: createTestHarnessRegistry([record]) });
  try {
    const project = await handle.deps.projectService.create({ name: "History conflict" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Conflict",
      status: "completed",
      agent: testHarnessId("conflict"),
    });
    await handle.deps.sessionService.update(session.id, { agent_session_id: "thread" });
    await persistSessionMessages(session.id, saved, handle.deps);
    const before = await handle.deps.sessionService.get(session.id);
    const get = (suffix: string) => handle.app.request(`/v1/sessions/${session.id}/${suffix}`);
    const conversation = await (await get("conversation")).json();
    expect(conversation).toMatchObject({ messages: saved, historyIssue: { code: "reconciliation_conflict" } });
    expect(await (await get("conversation/sources")).json()).toEqual({
      checkpoint: saved,
      native,
      checkpointError: null,
      nativeError: null,
    });
    const stream = await (await get("stream")).text();
    expect(stream).toContain("event: history_issue");
    expect(stream).toContain("event: end");
    const resume = await handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Continue" }),
    });
    expect(resume.status).toBe(409);
    expect(resumed).toBe(false);
    expect(await handle.deps.sessionService.get(session.id)).toEqual(before);
    expect(await (await get("conversation/sources")).json()).toEqual({
      checkpoint: saved,
      native,
      checkpointError: null,
      nativeError: null,
    });
  } finally {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});
