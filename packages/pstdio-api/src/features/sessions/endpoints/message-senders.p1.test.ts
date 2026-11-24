import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessExit, HarnessStartInput, SessionMessage } from "pstdio-api-contracts";
import { sessionMessageSenderSchema } from "pstdio-api-contracts";
import { createNativeAccount } from "../../../services/account/native-account";
import { createNativeStore } from "../../../services/account/native-store";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import { getSessionHistory } from "../session-history";
import { resolveMessageSender } from "../session-message-sender";
import { dispatchQueuedEntry } from "../session-queue-dispatch";

test.each([false, true])("records a session sender in delivered and saved history (queued: %s)", async (queued) => {
  const finished = Promise.withResolvers<HarnessExit>();
  const echo = (_ctx: unknown, input: HarnessStartInput) => {
    input.events.push({
      op: "add",
      path: "/messages/0",
      value: {
        id: "native-prompt",
        role: "user",
        parts: [{ type: "text", text: input.prompt }],
      },
    });
    return { agentSessionId: "native", done: finished.promise, stop: () => finished.resolve({ status: "cancelled" }) };
  };
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("sender", { provider: { start: echo, getMessages: () => [] } }),
    ]),
  });
  try {
    const project = await app.deps.projectService.create({ name: "Message authors" });
    const source = await app.deps.sessionService.create({
      project_id: project.id,
      title: "Release checks",
      agent: testHarnessId("sender"),
      status: "completed",
    });
    const target = await app.deps.sessionService.create({
      project_id: project.id,
      title: "Receiver",
      agent: testHarnessId("sender"),
      status: queued ? "in_progress" : "completed",
    });
    const sender = { type: "session" as const, id: source.id, name: source.title };
    const res = await app.app.request(`/v1/sessions/${target.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Check the release",
        ...(queued
          ? { sourceSessionId: source.id }
          : { source: { type: "session", id: source.id }, sourceSessionId: "ignored" }),
      }),
    });
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.follow_up.status).toBe(queued ? "queued" : "dispatched");
    if (queued) {
      const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(target.id);
      expect(entry!.sender_json).toEqual(sender);
      const snapshot = await app.app.request(`/v1/sessions/${target.id}/queued-messages`);
      expect((await snapshot.json()).messages[0].sender).toEqual(sender);
      await app.deps.sessionService.transitionStatus(target.id, "completed", { drainCapacity: false });
      await app.deps.sessionService.requeueAfterTerminal(target.id);
      await dispatchQueuedEntry(app.deps, { ...target, status: "queued" }, entry!);
    }
    for (let i = 0; i < 100 && !app.deps.sessionService.store.get(target.id)?.conversation?.getMessages().length; i++)
      await Bun.sleep(10);
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toContainEqual(
      expect.objectContaining({ session_id: target.id, sender_json: expect.objectContaining(sender) }),
    );
    expect(app.deps.sessionService.store.get(target.id)?.conversation?.getMessages()[0].sender).toMatchObject(sender);
    finished.resolve({ status: "completed" });
    for (let i = 0; i < 100 && (await app.deps.sessionService.get(target.id))?.status !== "completed"; i++)
      await Bun.sleep(10);
    const messages = await getSessionHistory(target.id, app.deps);
    expect(messages[0]).toMatchObject({ role: "user", sender });
    const saved = (await app.deps.sessionService.get(target.id))!;
    expect(saved.session_file_id).toBeString();
    const file = await app.deps.fileService.get(saved.session_file_id!);
    expect(((await Bun.file(file!.storage_path).json()) as SessionMessage[])[0].sender).toMatchObject(sender);
  } finally {
    finished.resolve({ status: "completed" });
    await app.close();
  }
});

test("queued attribution stores a bounded Unicode display name and the exact source identity", async () => {
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("sender")]),
  });
  try {
    const project = await app.deps.projectService.create({ name: "Bounded sender labels" });
    const title = "😀".repeat(4096);
    const source = await app.deps.sessionService.create({
      project_id: project.id,
      title,
      agent: testHarnessId("sender"),
    });
    const target = await app.deps.sessionService.create({
      project_id: project.id,
      title: "Receiver",
      agent: testHarnessId("sender"),
      status: "in_progress",
    });
    const response = await app.app.request(`/v1/sessions/${target.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Inspect this", sourceSessionId: source.id }),
    });
    expect(response.status).toBe(200);
    const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(target.id);
    expect(entry.sender_json).toMatchObject({ type: "session", id: source.id });
    expect(Buffer.byteLength(entry.sender_json!.name)).toBeLessThanOrEqual(1024);
    expect(title.startsWith(entry.sender_json!.name)).toBe(true);
    expect(entry.sender_json!.name).not.toContain("\uFFFD");
    expect((await app.deps.sessionService.get(source.id))!.title).toBe(title);
  } finally {
    await app.close();
  }
});

test("a source session from another project is never attributed to the local sender", async () => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Local" });
    const foreign = await app.deps.projectService.create({ name: "Other" });
    const source = await app.deps.sessionService.create({ project_id: foreign.id, title: "Private", agent: "fake" });
    expect(await resolveMessageSender(app.deps, project.id, { type: "session", id: source.id })).toBeUndefined();
    expect(await resolveMessageSender(app.deps, project.id)).toBeUndefined();
  } finally {
    await app.close();
  }
});

test("a saved account with an empty email still produces a valid user sender", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-sender-email-"));
  try {
    const app = await createTestApp();
    try {
      const file = join(root, "native-account.json");
      const account = createNativeAccount({
        file,
        environment: app.deps.environmentService,
        projects: app.deps.projectService,
      });
      try {
        const project = await app.deps.projectService.create({ name: "User sender fallback" });
        await createNativeStore(file).save({
          managerOrigin: "https://accounts.example.test",
          relayOrigin: "https://relay.example.test",
          accountId: "account",
          deviceId: (await app.deps.environmentService.get()).environmentId,
          token: "credential",
          email: "",
        });
        expect((await account.status()).login?.email).toBe("");
        const sender = await resolveMessageSender({ ...app.deps, accountService: account }, project.id, {
          type: "user",
        });
        const local = await resolveMessageSender(app.deps, project.id, { type: "user" });
        expect(sender).toMatchObject({ type: "user", id: "account" });
        expect(sessionMessageSenderSchema.safeParse(sender).success).toBe(true);
        expect(sender!.name).toBe(local!.name);
      } finally {
        await account.close();
      }
    } finally {
      await app.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
