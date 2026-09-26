import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessExit, SessionMessage } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

const message = (id: string, role: SessionMessage["role"]): SessionMessage => ({
  id,
  role,
  parts: [{ type: "text", text: id }],
});

test("resuming a stale checkpoint preserves native middle turns in GET, SSE, and the next checkpoint", async () => {
  const root = await mkdtemp(join(tmpdir(), "history-preservation-"));
  const native: SessionMessage[] = [message("first", "user"), message("reply", "assistant")];
  let completion = Promise.withResolvers<HarnessExit>();
  let resumeOffset: number | undefined;
  const record = createTestHarnessRecord("history", {
    provider: {
      start: (_ctx, input) => {
        native.forEach((value, index) => {
          input.events.push({ op: "add", path: `/messages/${index}`, value });
        });
        return {
          agentSessionId: "thread",
          done: completion.promise,
          stop: () => completion.resolve({ status: "cancelled" }),
        };
      },
      resume: (_ctx, input) => {
        resumeOffset = input.messageOffset;
        completion = Promise.withResolvers<HarnessExit>();
        const added = [message("follow-up", "user"), message("last", "assistant")];
        native.push(...added);
        added.forEach((value, index) => {
          input.events.push({ op: "add", path: `/messages/${input.messageOffset! + index}`, value });
        });
        return {
          agentSessionId: "thread",
          done: completion.promise,
          stop: () => completion.resolve({ status: "cancelled" }),
        };
      },
      getMessages: () => [...native],
    },
  });
  const handle = await createTestApp({ storageRoot: root, harnessRegistry: createTestHarnessRegistry([record]) });
  const request = (path: string, body?: unknown) =>
    handle.app.request(
      `/v1${path}`,
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
  const waitStatus = async (id: string, status: string) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await handle.deps.sessionService.get(id))?.status === status) return;
      await Bun.sleep(10);
    }
    throw new Error(`Session did not reach ${status}`);
  };
  const streamSnapshot = async (id: string) => {
    const response = await request(`/sessions/${id}/stream`);
    const reader = response.body!.getReader();
    let text = "";
    const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error("No conversation snapshot");
        text += decoder.decode(chunk.value, { stream: true });
        for (const event of text.split("\n\n")) {
          if (!event.includes("event: patch")) continue;
          const data = event.split("\n").find((line) => line.startsWith("data:"));
          if (data) return JSON.parse(data.slice(5)).value;
        }
      }
    } finally {
      await reader.cancel();
    }
  };
  try {
    const project = (await (await request("/projects", { name: "history" })).json()) as { id: string };
    const session = (await (
      await request("/sessions", {
        project_id: project.id,
        title: "history",
        prompt: "first",
        agent: testHarnessId("history"),
      })
    ).json()) as { id: string };
    completion.resolve({ status: "completed" });
    await waitStatus(session.id, "completed");
    native.push(message("missing", "user"), message("middle", "assistant"));
    expect((await (await request(`/sessions/${session.id}/conversation`)).json()).messages).toEqual(native);
    expect((await request(`/sessions/${session.id}/follow-up`, { prompt: "follow-up" })).status).toBe(200);
    for (let attempt = 0; resumeOffset === undefined && attempt < 100; attempt++) await Bun.sleep(10);
    expect(resumeOffset).toBe(4);
    expect((await (await request(`/sessions/${session.id}/conversation`)).json()).messages).toEqual(native);
    expect(await streamSnapshot(session.id)).toEqual(native);
    completion.resolve({ status: "completed" });
    await waitStatus(session.id, "completed");
    expect(await streamSnapshot(session.id)).toEqual(native);
    const saved = await handle.deps.sessionService.get(session.id);
    const file = await handle.deps.fileService.get(saved!.session_file_id!);
    expect(await Bun.file(file!.storage_path).json()).toEqual(native);
  } finally {
    completion.resolve({ status: "completed" });
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});
