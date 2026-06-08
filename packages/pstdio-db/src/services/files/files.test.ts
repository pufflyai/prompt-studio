import { afterAll, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createFilesDBService } from "./files";

let close: () => Promise<void>;
let service: ReturnType<typeof createFilesDBService>;
let projectId: string;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  service = createFilesDBService(result.db);

  const projectsService = createProjectsDBService(result.db);
  const project = await projectsService.create({ name: "test-project" });
  projectId = project.id;

  return result;
};

afterAll(async () => {
  await close?.();
});

test("insert and get returns the file record", async () => {
  await setup();

  const timestamp = new Date().toISOString();
  const file = {
    id: crypto.randomUUID(),
    project_id: projectId,
    file_name: "note.txt",
    file_kind: "attachment",
    storage_path: "/tmp/fake-path",
    mime_type: "text/plain",
    size_bytes: 11,
    hash: "abc123",
    created_at: timestamp,
    updated_at: timestamp,
  };

  await service.insert(file);

  const fetched = await service.get(file.id);
  expect(fetched?.id).toBe(file.id);
  expect(fetched?.file_name).toBe("note.txt");
  expect(fetched?.size_bytes).toBe(11);
});

test("list returns files for a project", async () => {
  const files = await service.list(projectId);
  expect(files.length).toBeGreaterThanOrEqual(1);
  expect(files[0]?.project_id).toBe(projectId);
});

test("updateMetadata updates size, hash, and timestamp", async () => {
  const files = await service.list(projectId);
  const file = files[0]!;

  await service.updateMetadata(file.id, {
    size_bytes: 99,
    hash: "new-hash",
    updated_at: new Date().toISOString(),
  });

  const updated = await service.get(file.id);
  expect(updated?.size_bytes).toBe(99);
  expect(updated?.hash).toBe("new-hash");
});

test("remove deletes the file record", async () => {
  const files = await service.list(projectId);
  const file = files[0]!;

  await service.remove(file.id);

  const fetched = await service.get(file.id);
  expect(fetched).toBeNull();
});
