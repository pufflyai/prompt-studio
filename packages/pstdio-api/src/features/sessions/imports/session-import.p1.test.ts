import { afterEach, expect, test } from "bun:test";
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionImportJob, SessionImportPreview } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const post = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const stamp = "2025-04-01T12:00:00.000Z";
const messages = [
  { id: "question", role: "user", parts: [{ type: "text", text: "Remember blue" }] },
  { id: "answer", role: "assistant", parts: [{ type: "text", text: "Blue it is" }] },
];
const setup = async () => {
  const root = await mkdtemp(join(tmpdir(), "session-import-"));
  roots.push(root);
  const backup = join(root, "backup");
  const tables = join(backup, "export", "tables");
  const storage = join(backup, "storage");
  await mkdir(tables, { recursive: true });
  await mkdir(storage);
  const rows = ["one", "missing"].map((id) => ({
    id,
    project_id: "old-project",
    title: `Old ${id}`,
    agent: "codex",
    status: "in_progress",
    agent_session_id: "original-native",
    session_file_id: `file-${id}`,
    last_selected_model: "original-model",
    params_json: { effort: "high" },
    created_at: stamp,
    updated_at: stamp,
  }));
  await writeFile(
    join(tables, "public.projects.jsonl"),
    `${JSON.stringify({ id: "old-project", name: "Old project" })}\n`,
  );
  await writeFile(join(tables, "public.sessions.jsonl"), `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
  await writeFile(
    join(tables, "public.files.jsonl"),
    `${rows
      .map((row) =>
        JSON.stringify({
          id: row.session_file_id,
          project_id: row.project_id,
          file_name: "session-messages.json",
          file_kind: "session_messages",
          storage_path: row.session_file_id,
        }),
      )
      .join("\n")}\n`,
  );
  await writeFile(join(storage, "file-one"), JSON.stringify(messages));
  return { root, backup, storage, tables };
};
const settled = async (app: Awaited<ReturnType<typeof createTestApp>>["app"], id: string) => {
  let job: SessionImportJob;
  for (let i = 0; i < 200; i++) {
    job = (await (await app.request(`/v1/session-imports/${id}`)).json()) as SessionImportJob;
    if (job.status !== "running") return job;
    await Bun.sleep(10);
  }
  throw new Error("Import did not settle");
};

test("previews and imports historical conversations, retries missing files, and skips duplicates", async () => {
  const source = await setup();
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "Destination" });
    const input = { sourcePath: source.backup, storagePath: source.storage, projectMap: { "old-project": project.id } };
    const before = await readFile(join(source.tables, "public.sessions.jsonl"), "utf8");
    const previewResponse = await handle.app.request("/v1/session-imports/preview", post(input));
    expect(previewResponse.status).toBe(200);
    const preview = (await previewResponse.json()) as SessionImportPreview;
    expect(preview).toMatchObject({
      total: 2,
      ready: 1,
      duplicates: 0,
      failed: 1,
      projects: [{ sourceProjectId: "old-project", name: "Old project", sessions: 2, targetProjectId: project.id }],
    });
    expect(await handle.deps.sessionService.list(project.id)).toEqual([]);
    const response = await handle.app.request("/v1/session-imports", post(input));
    expect(response.status).toBe(202);
    const started = (await response.json()) as SessionImportJob;
    const job = await settled(handle.app, started.id);
    expect(job).toMatchObject({ status: "completed", processed: 2, imported: 1, skipped: 0, failed: 1 });
    const [session] = await handle.deps.sessionService.list(project.id);
    expect(session).toMatchObject({
      title: "Old one",
      agent: "codex",
      agent_session_id: null,
      status: "cancelled",
      last_selected_model: "original-model",
      params_json: { effort: "high" },
      created_at: stamp,
      updated_at: stamp,
    });
    const history = await handle.app.request(`/v1/sessions/${session!.id}/conversation`);
    expect(((await history.json()) as { messages: unknown }).messages).toEqual(messages);
    expect(await handle.deps.sessionQueueEntriesService.hasEntries(session!.id)).toBe(false);
    const failures = await handle.app.request(`/v1/session-imports/${job.id}/errors`);
    expect(await failures.json()).toMatchObject({ errors: [{ sessionId: "missing", line: 2 }], nextOffset: null });
    await writeFile(join(source.storage, "file-missing"), JSON.stringify(messages));
    const resumed = await handle.app.request(`/v1/session-imports/${job.id}/resume`, { method: "POST" });
    expect(resumed.status).toBe(202);
    expect(await settled(handle.app, job.id)).toMatchObject({ imported: 1, skipped: 1, failed: 0, attempt: 2 });
    expect(await handle.deps.sessionService.list(project.id)).toHaveLength(2);
    const again = await handle.app.request("/v1/session-imports", post(input));
    expect(await settled(handle.app, ((await again.json()) as SessionImportJob).id)).toMatchObject({
      imported: 0,
      skipped: 2,
      failed: 0,
    });
    expect(await readFile(join(source.tables, "public.sessions.jsonl"), "utf8")).toBe(before);
  } finally {
    await handle.close();
  }
});

test.each([
  "none",
  "sessions",
  "checkpoint",
])("preserves imported transcript and attachment bytes with %s notification failure", async (failure) => {
  const source = await setup();
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "Attachments" });
    handle.deps.eventBus.subscribe((event) => {
      const checkpoint =
        event.table === "files" && (event.data as { file_kind?: string }).file_kind === "session_messages";
      if ((failure === "sessions" && event.table === "sessions") || (failure === "checkpoint" && checkpoint))
        throw new Error("Import notification subscriber failed");
    });
    const transcript = structuredClone(messages) as import("pstdio-api-contracts").SessionMessage[];
    transcript[0]!.parts.push({
      type: "file",
      fileId: "photo",
      filename: "diagram.png",
      mediaType: "image/png",
      url: "/v1/projects/old-project/session-attachments/photo/content",
    });
    await writeFile(join(source.storage, "file-one"), JSON.stringify(transcript));
    await writeFile(join(source.storage, "photo"), "original attachment bytes");
    await appendFile(
      join(source.tables, "public.files.jsonl"),
      `${JSON.stringify({ id: "photo", project_id: "old-project", file_name: "diagram.png", storage_path: "photo", mime_type: "image/png" })}\n`,
    );
    const response = await handle.app.request(
      "/v1/session-imports",
      post({ sourcePath: source.backup, storagePath: source.storage, projectMap: { "old-project": project.id } }),
    );
    const job = await settled(handle.app, ((await response.json()) as SessionImportJob).id);
    expect(job.imported).toBe(failure === "none" ? 1 : 0);
    const [session] = await handle.deps.sessionService.list(project.id);
    const result = await handle.app.request(`/v1/sessions/${session!.id}/conversation`);
    const copied = ((await result.json()) as { messages: import("pstdio-api-contracts").SessionMessage[] }).messages;
    const file = copied[0]!.parts.find((part) => part.type === "file")!;
    expect(file.fileId).not.toBe("photo");
    expect(file.url).toContain(`/projects/${project.id}/session-attachments/`);
    expect(await (await handle.app.request(file.url!)).text()).toBe("original attachment bytes");
    expect(await readFile(join(source.storage, "photo"), "utf8")).toBe("original attachment bytes");
  } finally {
    await handle.close();
  }
});

test("pauses at a durable checkpoint, rejects concurrent imports, and resumes after a host restart", async () => {
  const source = await setup();
  await writeFile(join(source.storage, "file-missing"), JSON.stringify(messages));
  const options = { databasePath: join(source.root, "live-db"), storageRoot: join(source.root, "live-storage") };
  let handle = await createTestApp(options);
  const copying = Promise.withResolvers<void>();
  const copied = Promise.withResolvers<void>();
  try {
    const project = await handle.deps.projectService.create({ name: "Resumed" });
    const upload = handle.deps.fileService.upload;
    let held = false;
    handle.deps.fileService.upload = async (...args) => {
      if (!held) {
        held = true;
        copying.resolve();
        await copied.promise;
      }
      return upload(...args);
    };
    const input = { sourcePath: source.backup, storagePath: source.storage, projectMap: { "old-project": project.id } };
    const response = await handle.app.request("/v1/session-imports", post(input));
    const job = (await response.json()) as SessionImportJob;
    expect(job).toMatchObject({ status: "running", phase: "preparing", processed: 0 });
    await copying.promise;
    expect((await handle.app.request("/v1/session-imports", post(input))).status).toBe(409);
    const pausing = handle.app.request(`/v1/session-imports/${job.id}/pause`, { method: "POST" });
    await Bun.sleep(0);
    copied.resolve();
    expect(await (await pausing).json()).toMatchObject({ status: "paused", imported: 1, cursor: 1 });
    await handle.close();
    handle = await createTestApp(options);
    expect(await (await handle.app.request(`/v1/session-imports/${job.id}`)).json()).toMatchObject({
      status: "paused",
      cursor: 1,
    });
    expect((await handle.app.request(`/v1/session-imports/${job.id}/resume`, { method: "POST" })).status).toBe(202);
    expect(await settled(handle.app, job.id)).toMatchObject({
      status: "completed",
      imported: 2,
      skipped: 0,
      failed: 0,
      cursor: 2,
    });
    expect(await handle.deps.sessionService.list(project.id)).toHaveLength(2);
  } finally {
    copied.resolve();
    await handle.close();
  }
});

test("a pause during resume preparation prevents the worker from launching", async () => {
  const source = await setup();
  const handle = await createTestApp();
  const entering = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  try {
    const project = await handle.deps.projectService.create({ name: "Paused preparation" });
    const response = await handle.app.request(
      "/v1/session-imports",
      post({ sourcePath: source.backup, storagePath: source.storage, projectMap: { "old-project": project.id } }),
    );
    const job = await settled(handle.app, ((await response.json()) as SessionImportJob).id);
    const get = handle.deps.projectService.get;
    handle.deps.projectService.get = async (...args) => {
      entering.resolve();
      await release.promise;
      return get(...args);
    };
    const resuming = handle.app.request(`/v1/session-imports/${job.id}/resume`, { method: "POST" });
    await entering.promise;
    const pausing = handle.app.request(`/v1/session-imports/${job.id}/pause`, { method: "POST" });
    await Bun.sleep(0);
    release.resolve();
    expect((await resuming).status).toBe(202);
    expect(await (await pausing).json()).toMatchObject({ status: "paused", processed: 0, attempt: 2 });
    expect(await handle.deps.sessionService.list(project.id)).toHaveLength(1);
  } finally {
    release.resolve();
    await handle.close();
  }
});

test("resume discards uncommitted failure journal entries after a crash", async () => {
  const source = await setup();
  const storageRoot = join(source.root, "live-storage");
  await rm(join(source.storage, "file-one"));
  const handle = await createTestApp({ storageRoot });
  try {
    const project = await handle.deps.projectService.create({ name: "Journal recovery" });
    const response = await handle.app.request(
      "/v1/session-imports",
      post({ sourcePath: source.backup, storagePath: source.storage, projectMap: { "old-project": project.id } }),
    );
    const job = await settled(handle.app, ((await response.json()) as SessionImportJob).id);
    expect(job.failed).toBe(2);
    await writeFile(
      join(storageRoot, "session-imports", `${job.id}.json`),
      JSON.stringify({ ...job, status: "running", cursor: 0, processed: 0, failed: 0 }),
    );
    await writeFile(
      join(storageRoot, "session-imports", `${job.id}.jsonl`),
      `${JSON.stringify({ line: 1, sessionId: "one", error: "Uncommitted error" })}\n`,
    );
    expect((await handle.app.request(`/v1/session-imports/${job.id}/resume`, { method: "POST" })).status).toBe(202);
    expect(await settled(handle.app, job.id)).toMatchObject({ failed: 2, processed: 2 });
    const first = (await (await handle.app.request(`/v1/session-imports/${job.id}/errors?limit=1`)).json()) as {
      errors: { sessionId: string; error: string }[];
      nextOffset: number;
    };
    expect(first.nextOffset).toBe(1);
    expect(first.errors[0]?.sessionId).toBe("one");
    expect(first.errors[0]?.error).not.toBe("Uncommitted error");
    const second = await (await handle.app.request(`/v1/session-imports/${job.id}/errors?offset=1&limit=1`)).json();
    expect(second).toMatchObject({ errors: [{ sessionId: "missing" }], nextOffset: null });
  } finally {
    await handle.close();
  }
});

test("rejects invalid mappings and confines file reads to the declared backup and storage roots", async () => {
  const source = await setup();
  const handle = await createTestApp();
  try {
    const invalid = await handle.app.request(
      "/v1/session-imports/preview",
      post({ sourcePath: source.backup, projectMap: { "old-project": "missing-project" } }),
    );
    expect(invalid.status).toBe(400);
    const outside = join(source.root, "outside.json");
    await writeFile(outside, JSON.stringify(messages));
    await rm(join(source.storage, "file-one"));
    const exported = (await readFile(join(source.tables, "public.files.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    exported[0].storage_path = outside;
    await writeFile(
      join(source.tables, "public.files.jsonl"),
      `${exported.map((file) => JSON.stringify(file)).join("\n")}\n`,
    );
    const preview = await handle.app.request(
      "/v1/session-imports/preview",
      post({ sourcePath: source.backup, storagePath: source.storage }),
    );
    expect(await preview.json()).toMatchObject({ ready: 0, failed: 2 });
  } finally {
    await handle.close();
  }
});

test("crash recovery removes unfinished uploads and preserves files of a committed session", async () => {
  const source = await setup();
  const storageRoot = join(source.root, "live-storage");
  const handle = await createTestApp({ storageRoot });
  try {
    const project = await handle.deps.projectService.create({ name: "Staging recovery" });
    const input = { sourcePath: source.backup, storagePath: source.storage, projectMap: { "old-project": project.id } };
    const started = await handle.app.request("/v1/session-imports", post(input));
    const job = await settled(handle.app, ((await started.json()) as SessionImportJob).id);
    const [session] = await handle.deps.sessionService.list(project.id);
    const abandoned = await handle.deps.fileService.upload({
      project_id: project.id,
      file_name: "unfinished.png",
      file_kind: "session_attachment",
      data: Buffer.from("partial import"),
    });
    const checkpoint = join(storageRoot, "session-imports", `${job.id}.json`);
    const staging = join(storageRoot, "session-imports", `${job.id}.staging.json`);
    await writeFile(
      checkpoint,
      JSON.stringify({ ...job, status: "paused", cursor: 0, processed: 0, imported: 0, failed: 0 }),
    );
    await writeFile(
      staging,
      JSON.stringify({ sessionId: "not-committed", projectId: project.id, files: [abandoned.id] }),
    );
    await handle.app.request(`/v1/session-imports/${job.id}/resume`, { method: "POST" });
    const recovered = await settled(handle.app, job.id);
    expect(await handle.deps.fileService.get(abandoned.id)).toBeNull();
    expect(await Bun.file(abandoned.storage_path).exists()).toBe(false);
    expect(recovered).toMatchObject({ imported: 0, skipped: 1, failed: 1 });
    await writeFile(
      checkpoint,
      JSON.stringify({ ...recovered, status: "paused", cursor: 0, processed: 0, skipped: 0, failed: 0 }),
    );
    await writeFile(
      staging,
      JSON.stringify({ sessionId: session!.id, projectId: project.id, files: [session!.session_file_id] }),
    );
    await handle.app.request(`/v1/session-imports/${job.id}/resume`, { method: "POST" });
    expect(await settled(handle.app, job.id)).toMatchObject({ skipped: 1, failed: 1 });
    const response = await handle.app.request(`/v1/sessions/${session!.id}/conversation`);
    expect(((await response.json()) as { messages: unknown }).messages).toEqual(messages);
    expect(await handle.deps.sessionService.list(project.id)).toHaveLength(1);
  } finally {
    await handle.close();
  }
});

test("changed exported tables stop a resumed job before it restores more sessions", async () => {
  const source = await setup();
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "Changed backup" });
    const started = await handle.app.request(
      "/v1/session-imports",
      post({ sourcePath: source.backup, storagePath: source.storage, projectMap: { "old-project": project.id } }),
    );
    const job = await settled(handle.app, ((await started.json()) as SessionImportJob).id);
    await appendFile(join(source.tables, "public.sessions.jsonl"), "{}\n");
    await handle.app.request(`/v1/session-imports/${job.id}/resume`, { method: "POST" });
    expect(await settled(handle.app, job.id)).toMatchObject({
      status: "failed",
      imported: 0,
      error: "Exported tables changed; start a new import to inspect the new source.",
    });
    expect(await handle.deps.sessionService.list(project.id)).toHaveLength(1);
  } finally {
    await handle.close();
  }
});
