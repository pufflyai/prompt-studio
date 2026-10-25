import { expect, test } from "bun:test";
import type { HarnessExit, SessionMessage } from "pstdio-api-contracts";
import type { HarnessProvider } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { getSessionMessages } from "./get-session-messages";
import { initializeConversation } from "./initialize-conversation";
import { getSessionHistory } from "./session-history";
import { persistSessionMessages } from "./session-messages";
import { createSessionScheduler } from "./session-scheduler";

const saved: SessionMessage[] = [
  { id: "user", role: "user", parts: [{ type: "text", text: "Question" }] },
  { id: "reply", role: "assistant", parts: [{ type: "text", text: "Saved answer" }] },
];

const setup = async (provider: Partial<HarnessProvider>) => {
  const resumed: string[] = [];
  const finished = (): { done: Promise<HarnessExit>; stop: () => void } => ({
    done: Promise.resolve({ status: "completed" }),
    stop: () => {},
  });
  const record = createTestHarnessRecord("history", {
    provider: {
      start: finished,
      resume: (_ctx, input) => {
        resumed.push(input.prompt);
        return finished();
      },
      ...provider,
    },
  });
  const handle = await createTestApp({ harnessRegistry: createTestHarnessRegistry([record]) });
  const project = await handle.deps.projectService.create({ name: "History dispatch" });
  const session = await handle.deps.sessionService.create({
    project_id: project.id,
    title: "History",
    agent: testHarnessId("history"),
    status: "completed",
  });
  await handle.deps.sessionService.update(session.id, { agent_session_id: "thread" });
  await persistSessionMessages(session.id, saved, handle.deps);
  // Let the dispatched run finish before the test closes the database.
  const settled = async () => {
    for (let attempt = 0; attempt < 200; attempt++) {
      if ((await handle.deps.sessionService.get(session.id))?.status === "completed") return;
      await Bun.sleep(10);
    }
  };
  return { handle, resumed, settled, session: (await handle.deps.sessionService.get(session.id))! };
};

const unpaired: Partial<HarnessProvider> = {
  getMessages: () => [saved[0]],
  recoverMessages: () => ({ kind: "conflict", category: "unpairable" }),
};

test("a follow-up starts when the harness cannot pair the saved and native histories", async () => {
  const { handle, session, resumed, settled } = await setup(unpaired);
  try {
    const result = await createSessionScheduler(handle.deps).startOrQueueExisting({ session, prompt: "Continue" });
    expect(result).toEqual({ status: "dispatched" });
    await settled();
    expect(resumed).toEqual(["Continue"]);
    expect(await getSessionHistory(session.id, handle.deps)).toEqual(expect.arrayContaining(saved));
  } finally {
    await handle.close();
  }
});

test("a queued follow-up drains when the harness cannot pair the histories", async () => {
  const { handle, session, resumed, settled } = await setup(unpaired);
  try {
    await handle.deps.sessionService.queueExistingWithEntry({
      id: session.id,
      prompt: "Keep this prompt",
      request_kind: "follow_up",
    });
    await createSessionScheduler(handle.deps).drainQueue();
    await settled();
    expect(resumed).toEqual(["Keep this prompt"]);
    expect(await handle.deps.sessionQueueEntriesService.listPendingBySession(session.id)).toEqual([]);
  } finally {
    await handle.close();
  }
});

test("an unreadable native transcript keeps the saved conversation", async () => {
  const { handle, session } = await setup({
    getMessages: () => {
      throw new Error("Native history unavailable");
    },
  });
  try {
    const entry = initializeConversation(session.id, handle.deps, async () => {});
    await entry.conversationReady;
    expect(await getSessionHistory(session.id, handle.deps)).toEqual(saved);
  } finally {
    await handle.close();
  }
});

test("summary history treats a deleted session as empty", async () => {
  const handle = await createTestApp();
  try {
    expect(await getSessionMessages("deleted-session", handle.deps)).toEqual([]);
  } finally {
    await handle.close();
  }
});
