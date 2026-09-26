import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionMessage } from "pstdio-api-contracts";
import { createDb, createFilesDBService, createProjectsDBService, createSessionsDBService } from "pstdio-db";
import { createFilesStorageService } from "pstdio-storage";
import { createFileService } from "../../services/file-service";
import { testHarnessId } from "../harnesses/test-harness-registry";
import { EventBus } from "../sync/event-bus";
import { persistSessionMessages } from "./session-messages";

test("checkpoints save exact complete arrays, including empty slots and an intentional empty replacement", async () => {
  const root = await mkdtemp(join(tmpdir(), "session-checkpoints-"));
  const conn = await createDb({ path: ":memory:" });
  const sessionService = createSessionsDBService(conn.db);
  const fileService = createFileService({
    eventBus: new EventBus(),
    filesDBService: createFilesDBService(conn.db),
    filesStorageService: createFilesStorageService(root),
  });
  try {
    const project = await createProjectsDBService(conn.db).create({ name: "history" });
    const session = await sessionService.create({
      project_id: project.id,
      title: "history",
      agent: testHarnessId("fake"),
    });
    const messages: SessionMessage[] = [{ id: "empty", role: "assistant", parts: [{ type: "text", text: "" }] }];
    await persistSessionMessages(session.id, messages, { sessionService, fileService });
    const saved = await sessionService.get(session.id);
    const file = await fileService.get(saved!.session_file_id!);
    expect(await Bun.file(file!.storage_path).json()).toEqual(messages);
    const complete = [
      ...messages,
      { id: "reply", role: "assistant" as const, parts: [{ type: "text" as const, text: "complete" }] },
    ];
    await persistSessionMessages(session.id, complete, { sessionService, fileService });
    expect(await Bun.file(file!.storage_path).json()).toEqual(complete);
    await persistSessionMessages(session.id, [], { sessionService, fileService });
    expect(await Bun.file(file!.storage_path).json()).toEqual([]);
    expect((await sessionService.get(session.id))!.session_file_id).toBe(saved!.session_file_id);
  } finally {
    await conn.close();
    await rm(root, { recursive: true, force: true });
  }
});
