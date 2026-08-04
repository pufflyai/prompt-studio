import { describe, expect, test } from "bun:test";
import { EventBus, type SyncEvent } from "../features/sync/event-bus";
import { createExtensionFileService, type ExtensionFileServiceDeps } from "./extension-file-service";

const projectInstance = {
  id: "instance-1",
  installed_extension_id: "installed-1",
  scope_type: "project",
  scope_id: "project-1",
  display_name_override: null,
  enabled: true,
  config_json: {},
  diagnostics_json: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const fileRow = (id: string) => ({
  id,
  project_id: "project-1",
  file_name: "notes.txt",
  file_kind: "extension",
  storage_path: `/tmp/project-1/${id}`,
  mime_type: "text/plain" as string | null,
  size_bytes: 5,
  hash: "hash",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const ownershipScope = {
  project_id: "project-1",
  extension_instance_id: "instance-1",
  scope_type: "resource",
  scope_id: "ticket-1",
};

const makeHarness = (options?: {
  instance?: typeof projectInstance | null;
  ownedFile?: ReturnType<typeof fileRow>;
}) => {
  const attached: unknown[] = [];
  const detached: unknown[] = [];
  const uploaded: unknown[] = [];
  const removed: string[] = [];
  const events: SyncEvent[] = [];

  const eventBus = new EventBus();
  eventBus.subscribe((event) => events.push(event));

  const deps: ExtensionFileServiceDeps = {
    eventBus,
    extensionFilesDBService: {
      attach: async (input) => {
        attached.push(input);
        return { ...input, id: crypto.randomUUID(), created_at: "2026-01-01T00:00:00.000Z" };
      },
      list: async () => [fileRow("file-1")],
      getOwnedFile: async () => options?.ownedFile ?? null,
      detach: async (input) => {
        detached.push(input);
        return true;
      },
    },
    extensionInstancesDBService: {
      get: async () => (options?.instance === undefined ? projectInstance : options.instance),
    },
    fileService: {
      upload: async (input) => {
        uploaded.push(input);
        return { ...fileRow("file-1"), file_name: input.file_name };
      },
      remove: async (fileId) => {
        removed.push(fileId);
        return true;
      },
    },
  };

  return { service: createExtensionFileService(deps), attached, detached, uploaded, removed, events };
};

describe("ExtensionFileService", () => {
  test("upload stores bytes, attaches ownership, and emits the files set event", async () => {
    const harness = makeHarness();

    const file = await harness.service.upload({
      ...ownershipScope,
      file_name: "notes.txt",
      data: Buffer.from("hello"),
      mime_type: "text/plain",
    });

    expect(file?.id).toBe("file-1");
    expect(harness.uploaded).toEqual([
      expect.objectContaining({ project_id: "project-1", file_name: "notes.txt", file_kind: "extension" }),
    ]);
    expect(harness.attached).toEqual([expect.objectContaining({ ...ownershipScope, file_id: "file-1" })]);
    expect(harness.events).toEqual([
      expect.objectContaining({ table: "files", op: "set", data: expect.objectContaining({ id: "file-1" }) }),
    ]);
  });

  test("upload refuses instances that are not project instances of the project", async () => {
    const harness = makeHarness({ instance: { ...projectInstance, scope_id: "other-project" } });

    const file = await harness.service.upload({
      ...ownershipScope,
      file_name: "notes.txt",
      data: Buffer.from("hello"),
    });

    expect(file).toBeNull();
    expect(harness.uploaded).toEqual([]);
    expect(harness.attached).toEqual([]);
    expect(harness.events).toEqual([]);
  });

  test("list returns owned files for a valid instance and null otherwise", async () => {
    const valid = makeHarness();
    await expect(valid.service.list(ownershipScope)).resolves.toEqual([expect.objectContaining({ id: "file-1" })]);

    const invalid = makeHarness({ instance: null });
    await expect(invalid.service.list(ownershipScope)).resolves.toBeNull();
  });

  test("remove detaches ownership, deletes the file, and emits the files delete event", async () => {
    const harness = makeHarness({ ownedFile: fileRow("file-1") });

    const result = await harness.service.remove({
      project_id: "project-1",
      extension_instance_id: "instance-1",
      file_id: "file-1",
    });

    expect(result).toBe(true);
    expect(harness.detached).toEqual([
      expect.objectContaining({ project_id: "project-1", extension_instance_id: "instance-1", file_id: "file-1" }),
    ]);
    expect(harness.removed).toEqual(["file-1"]);
    expect(harness.events).toEqual([expect.objectContaining({ table: "files", op: "delete", data: { id: "file-1" } })]);
  });

  test("remove leaves state untouched when the file is not owned by the instance", async () => {
    const harness = makeHarness();

    const result = await harness.service.remove({
      project_id: "project-1",
      extension_instance_id: "instance-1",
      file_id: "missing",
    });

    expect(result).toBe(false);
    expect(harness.detached).toEqual([]);
    expect(harness.removed).toEqual([]);
    expect(harness.events).toEqual([]);
  });
});
