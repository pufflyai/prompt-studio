import { afterAll, describe, expect, test } from "bun:test";
import fs, { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JsonPatch, SessionMessage } from "pstdio-api-contracts";
import { createEventStore } from "pstdio-api-runtime-host";
import { createDb, createFilesDBService, createProjectsDBService, createSessionsDBService } from "pstdio-db";
import { createFilesStorageService } from "pstdio-storage";
import { createFileService } from "../../services/file-service";
import { testHarnessId } from "../harnesses/test-harness-registry";
import { buildMessagesFromPatches, persistSessionMessages } from "./session-messages";

const msg = (id: string, role: "user" | "assistant", text: string): SessionMessage => ({
  id,
  role,
  parts: [{ type: "text", text }],
});

describe("buildMessagesFromPatches", () => {
  test("returns empty array for empty patches", () => {
    expect(buildMessagesFromPatches([])).toEqual([]);
  });

  test("builds messages from sequential add patches", () => {
    const patches: JsonPatch[] = [
      { op: "add", path: "/messages/0", value: msg("1", "user", "hello") },
      { op: "add", path: "/messages/1", value: msg("2", "assistant", "hi") },
    ];

    const result = buildMessagesFromPatches(patches);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("1");
    expect(result[1].id).toBe("2");
  });

  test("replaces existing message at index", () => {
    const patches: JsonPatch[] = [
      { op: "add", path: "/messages/0", value: msg("1", "user", "hello") },
      { op: "replace", path: "/messages/0", value: msg("1", "user", "hello updated") },
    ];

    const result = buildMessagesFromPatches(patches);

    expect(result).toHaveLength(1);
    expect(result[0].parts[0]).toEqual({ type: "text", text: "hello updated" });
  });

  test("ignores gaps when a replace lands past the current length", () => {
    const patches: JsonPatch[] = [
      { op: "add", path: "/messages/0", value: msg("1", "user", "hello") },
      { op: "replace", path: "/messages/3", value: msg("4", "assistant", "late") },
    ];

    const result = buildMessagesFromPatches(patches);

    expect(result.map((message) => message.id)).toEqual(["1", "4"]);
  });

  test("filters out approval_request patches", () => {
    const patches: JsonPatch[] = [
      { op: "add", path: "/messages/0", value: msg("1", "user", "hello") },
      { op: "add", path: "/approval_request", value: { id: "req-1" } },
      { op: "add", path: "/messages/1", value: msg("2", "assistant", "hi") },
    ];

    const result = buildMessagesFromPatches(patches);

    expect(result).toHaveLength(2);
  });

  test("replaces all messages when patch path is /messages", () => {
    const nextMessages: SessionMessage[] = [msg("10", "user", "start"), msg("11", "assistant", "reply")];
    const result = buildMessagesFromPatches(
      [{ op: "replace", path: "/messages", value: nextMessages }],
      [msg("1", "user", "old")],
    );

    expect(result).toEqual(nextMessages);
  });

  test("applies patches onto initial messages", () => {
    const initial: SessionMessage[] = [msg("1", "user", "hello"), msg("2", "assistant", "hi")];

    const patches: JsonPatch[] = [
      { op: "add", path: "/messages/2", value: msg("3", "user", "follow up") },
      { op: "add", path: "/messages/3", value: msg("4", "assistant", "sure") },
    ];

    const result = buildMessagesFromPatches(patches, initial);

    expect(result).toHaveLength(4);
    expect(result[0].id).toBe("1");
    expect(result[2].id).toBe("3");
    expect(result[3].id).toBe("4");
  });

  test("resume with messageOffset=0 preserves original messages before follow-up", () => {
    // When getMessages() fails or returns empty, messageOffset falls back to 0.
    // The accumulator pushes follow-up patches starting at index 0.
    // On persist, these are merged with initialMessages from the prior session file.
    // splice(0, 0, followUpUser) inserts BEFORE the originals → wrong order.
    const initial: SessionMessage[] = [msg("1", "user", "original prompt"), msg("2", "assistant", "original reply")];

    const patches: JsonPatch[] = [
      { op: "add", path: "/messages/0", value: msg("3", "user", "follow-up prompt") },
      { op: "add", path: "/messages/1", value: msg("4", "assistant", "follow-up reply") },
    ];

    const result = buildMessagesFromPatches(patches, initial);

    // Follow-up must appear AFTER originals
    expect(result.map((m) => m.id)).toEqual(["1", "2", "3", "4"]);
  });

  test("removes empty parts and skips messages with no remaining parts", () => {
    const patches: JsonPatch[] = [
      {
        op: "replace",
        path: "/messages",
        value: [
          { id: "1", role: "assistant", parts: [{ type: "reasoning", text: "" }] },
          {
            id: "2",
            role: "assistant",
            parts: [
              { type: "text", text: "   " },
              { type: "tool", tool: "read" },
            ],
          },
        ] satisfies SessionMessage[],
      },
    ];

    const result = buildMessagesFromPatches(patches);

    expect(result).toEqual([{ id: "2", role: "assistant", parts: [{ type: "tool", tool: "read" }] }]);
  });
});

const setupDb = async (tempRoot: string, label: string) => {
  const conn = await createDb({ path: ":memory:" });
  const storageRoot = join(tempRoot, `storage-${label}`);
  fs.mkdirSync(storageRoot, { recursive: true });

  const filesDBService = createFilesDBService(conn.db);
  const filesStorageService = createFilesStorageService(storageRoot);

  return {
    conn,
    sessionsService: createSessionsDBService(conn.db),
    fileService: createFileService({ filesDBService, filesStorageService }),
    projectsService: createProjectsDBService(conn.db),
  };
};

describe("persistSessionMessages", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-session-messages-test-"));

  afterAll(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("uploads file and sets session_file_id on first run", async () => {
    const { conn, sessionsService, fileService, projectsService } = await setupDb(tempRoot, "first-run");

    const proj = await projectsService.create({ name: "test" });
    const session = await sessionsService.create({
      project_id: proj.id,
      title: "test",
      agent: testHarnessId("claude-code"),
    });

    const eventStore = createEventStore();
    eventStore.push({ op: "add", path: "/messages/0", value: msg("1", "user", "hello") });
    eventStore.push({ op: "add", path: "/messages/1", value: msg("2", "assistant", "hi") });

    await persistSessionMessages(session.id, eventStore.getHistory(), {
      sessionService: sessionsService,
      fileService,
    });

    const updated = await sessionsService.get(session.id);
    expect(updated?.session_file_id).not.toBeNull();

    const file = await fileService.get(updated!.session_file_id!);
    const content = JSON.parse(fs.readFileSync(file!.storage_path, "utf-8"));
    expect(content).toHaveLength(2);
    expect(content[0].id).toBe("1");
    expect(content[1].id).toBe("2");

    eventStore.close();
    await conn.close();
  });

  test("updates existing file on resume", async () => {
    const { conn, sessionsService, fileService, projectsService } = await setupDb(tempRoot, "resume");

    const proj = await projectsService.create({ name: "test" });
    const session = await sessionsService.create({
      project_id: proj.id,
      title: "test",
      agent: testHarnessId("claude-code"),
    });

    // First run
    const eventStore1 = createEventStore();
    eventStore1.push({ op: "add", path: "/messages/0", value: msg("1", "user", "hello") });
    eventStore1.push({ op: "add", path: "/messages/1", value: msg("2", "assistant", "hi") });
    await persistSessionMessages(session.id, eventStore1.getHistory(), {
      sessionService: sessionsService,
      fileService,
    });
    eventStore1.close();

    // Resume — new messages at offset 2
    const eventStore2 = createEventStore();
    eventStore2.push({ op: "add", path: "/messages/2", value: msg("3", "user", "follow up") });
    eventStore2.push({ op: "add", path: "/messages/3", value: msg("4", "assistant", "sure") });
    await persistSessionMessages(session.id, eventStore2.getHistory(), {
      sessionService: sessionsService,
      fileService,
    });
    eventStore2.close();

    const updated = await sessionsService.get(session.id);
    const file = await fileService.get(updated!.session_file_id!);
    const content = JSON.parse(fs.readFileSync(file!.storage_path, "utf-8"));

    expect(content).toHaveLength(4);
    expect(content[0].id).toBe("1");
    expect(content[2].id).toBe("3");
    expect(content[3].id).toBe("4");

    await conn.close();
  });

  test("uploads file when history contains /messages replace patch", async () => {
    const { conn, sessionsService, fileService, projectsService } = await setupDb(tempRoot, "replace-patch");

    const proj = await projectsService.create({ name: "test" });
    const session = await sessionsService.create({
      project_id: proj.id,
      title: "test",
      agent: testHarnessId("opencode"),
    });

    const eventStore = createEventStore();
    eventStore.push({
      op: "replace",
      path: "/messages",
      value: [msg("1", "user", "hello"), msg("2", "assistant", "hi")],
    });

    await persistSessionMessages(session.id, eventStore.getHistory(), {
      sessionService: sessionsService,
      fileService,
    });

    const updated = await sessionsService.get(session.id);
    expect(updated?.session_file_id).not.toBeNull();

    const file = await fileService.get(updated!.session_file_id!);
    const content = JSON.parse(fs.readFileSync(file!.storage_path, "utf-8"));
    expect(content).toHaveLength(2);
    expect(content[0].id).toBe("1");
    expect(content[1].id).toBe("2");

    eventStore.close();
    await conn.close();
  });

  test("does not persist messages that only contain empty parts", async () => {
    const { conn, sessionsService, fileService, projectsService } = await setupDb(tempRoot, "empty-parts");

    const proj = await projectsService.create({ name: "test" });
    const session = await sessionsService.create({
      project_id: proj.id,
      title: "test",
      agent: testHarnessId("opencode"),
    });

    const eventStore = createEventStore();
    eventStore.push({
      op: "replace",
      path: "/messages",
      value: [{ id: "1", role: "assistant", parts: [{ type: "reasoning", text: " " }] }] satisfies SessionMessage[],
    });

    await persistSessionMessages(session.id, eventStore.getHistory(), {
      sessionService: sessionsService,
      fileService,
    });

    const updated = await sessionsService.get(session.id);
    expect(updated?.session_file_id).toBeNull();

    eventStore.close();
    await conn.close();
  });
});
