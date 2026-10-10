import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

test("queue discovery, complete edits, and reorder preserve request settings and reject stale writes", async () => {
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "Requests" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Requests",
      agent: "unavailable",
    });
    const queue = handle.deps.sessionQueueEntriesService;
    const first = await queue.create({
      session_id: session.id,
      request_kind: "follow_up",
      prompt: "First",
      model: "one",
      params_json: { thinking: "high" },
    });
    const second = await queue.create({
      session_id: session.id,
      request_kind: "follow_up",
      prompt: "Second",
      model: "two",
      params_json: { thinking: "low" },
    });
    const path = `/v1/sessions/${session.id}/queued-follow-ups`;
    const discovered = await handle.app.request(path);
    expect(discovered.status).toBe(200);
    expect((await discovered.json()).requests[0]).toMatchObject({
      model: "one",
      params: { thinking: "high" },
      revision: first.revision,
    });
    const update = await handle.app.request(`${path}/${first.queue_position}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Edited", expectedRevision: first.revision }),
    });
    expect(update.status).toBe(200);
    expect((await update.json()).request).toMatchObject({
      prompt: "Edited",
      model: "one",
      params: { thinking: "high" },
    });
    const move = await handle.app.request(`${path}/${first.queue_position}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction: "down" }),
    });
    expect(move.status).toBe(200);
    expect(await queue.get(second.queue_position)).toMatchObject({
      prompt: "Edited",
      model: "one",
      params_json: { thinking: "high" },
    });
    const stale = await handle.app.request(`${path}/${first.queue_position}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Stale", expectedRevision: first.revision }),
    });
    expect(stale.status).toBe(409);
    expect((await queue.get(first.queue_position))!.prompt).toBe("Second");
  } finally {
    await handle.close();
  }
});

test("combining returns one saved request without sending input or modifying session defaults", async () => {
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "Combine" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Combine",
      agent: "unavailable",
      last_selected_model: "default",
    });
    const queue = handle.deps.sessionQueueEntriesService;
    const first = await queue.create({
      session_id: session.id,
      request_kind: "follow_up",
      prompt: "First",
      model: "saved",
    });
    const second = await queue.create({
      session_id: session.id,
      request_kind: "follow_up",
      prompt: "Second",
      model: "saved",
    });
    const response = await handle.app.request(
      `/v1/sessions/${session.id}/queued-follow-ups/${second.queue_position}/combine`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePosition: first.queue_position,
          sourceRevision: first.revision,
          targetRevision: second.revision,
        }),
      },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).request.prompt).toBe("First\n\nSecond");
    expect(await queue.listPendingBySession(session.id)).toHaveLength(1);
    expect(handle.deps.sessionService.store.get(session.id)).toBeNull();
    expect((await handle.deps.sessionService.get(session.id))!.last_selected_model).toBe("default");
  } finally {
    await handle.close();
  }
});

test("a long reorder is one revision-guarded change and a stale removal preserves the request", async () => {
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "Reorder" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Reorder",
      agent: "unavailable",
    });
    const queue = handle.deps.sessionQueueEntriesService;
    const entries = await Promise.all(
      ["A", "B", "C", "D"].map((prompt) =>
        queue.create({
          session_id: session.id,
          request_kind: "follow_up",
          prompt,
          model: prompt,
          params_json: { thinking: prompt },
        }),
      ),
    );
    const source = entries[0];
    const path = `/v1/sessions/${session.id}/queued-follow-ups`;
    const response = await handle.app.request(`${path}/${source.queue_position}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        direction: "down",
        steps: 3,
        expectedRevision: source.revision,
        expectedOrder: entries.map((entry) => ({ queuePosition: entry.queue_position, revision: entry.revision })),
      }),
    });
    expect(response.status).toBe(200);
    expect((await queue.listPendingBySession(session.id)).map((entry) => [entry.prompt, entry.model])).toEqual([
      ["B", "B"],
      ["C", "C"],
      ["D", "D"],
      ["A", "A"],
    ]);
    const stale = await handle.app.request(`${path}/${source.queue_position}?expectedRevision=${source.revision}`, {
      method: "DELETE",
    });
    expect(stale.status).toBe(409);
    expect(await queue.listPendingBySession(session.id)).toHaveLength(4);
  } finally {
    await handle.close();
  }
});

test("complete edits validate settings and attachment ownership without sending or changing session defaults", async () => {
  let calls = 0;
  const handle = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("queue-editor", {
        provider: {
          params: {
            thinking: {
              type: "select",
              defaultValue: "low",
              options: [
                { label: "Low", value: "low" },
                { label: "High", value: "high" },
              ],
            },
            safe: { type: "boolean", defaultValue: true },
          },
          listModels: () => [{ id: "one" }, { id: "two" }],
          start: () => {
            calls++;
            throw new Error("Editing must not start a run");
          },
        },
      }),
    ]),
  });
  try {
    const project = await handle.deps.projectService.create({ name: "Edit" });
    const other = await handle.deps.projectService.create({ name: "Other" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Edit",
      agent: testHarnessId("queue-editor"),
      last_selected_model: "one",
      params_json: { thinking: "low", safe: true },
    });
    const file = await handle.deps.fileService.upload({
      project_id: project.id,
      file_name: "notes.txt",
      file_kind: "session_attachment",
      mime_type: "text/plain",
      data: Buffer.from("notes"),
    });
    const foreign = await handle.deps.fileService.upload({
      project_id: other.id,
      file_name: "other.txt",
      file_kind: "session_attachment",
      mime_type: "text/plain",
      data: Buffer.from("other"),
    });
    const entry = await handle.deps.sessionQueueEntriesService.create({
      session_id: session.id,
      request_kind: "follow_up",
      prompt: "Original",
      model: "one",
      params_json: { thinking: "low", safe: true },
    });
    const path = `/v1/sessions/${session.id}/queued-follow-ups/${entry.queue_position}`;
    const patch = (input: unknown) =>
      handle.app.request(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    for (const invalid of [
      { model: "missing" },
      { params: { thinking: "unsupported" } },
      { attachments: [{ file_id: foreign.id }] },
    ]) {
      expect((await patch({ prompt: "Invalid", expectedRevision: entry.revision, ...invalid })).status).toBe(400);
      expect((await handle.deps.sessionQueueEntriesService.get(entry.queue_position))!.revision).toBe(entry.revision);
    }
    const edited = await patch({
      prompt: "Complete",
      expectedRevision: entry.revision,
      model: "two",
      params: { thinking: "high", safe: false },
      attachments: [{ file_id: file.id }],
    });
    expect(edited.status).toBe(200);
    const saved = (await edited.json()).request;
    expect(saved).toMatchObject({
      prompt: "Complete",
      model: "two",
      params: { thinking: "high", safe: false },
      attachments: [{ file_id: file.id }],
    });
    const reset = await patch({
      prompt: "Reset",
      expectedRevision: saved.revision,
      model: null,
      params: null,
      attachments: [],
    });
    expect(reset.status).toBe(200);
    expect((await reset.json()).request).toMatchObject({
      model: null,
      params: { thinking: "low", safe: true },
      attachments: [],
    });
    expect((await handle.deps.sessionService.get(session.id))!.last_selected_model).toBe("one");
    expect(calls).toBe(0);
  } finally {
    await handle.close();
  }
});
