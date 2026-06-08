import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { files, projects } from "../../db/schemas.pg";
import { createTemplatesDBService } from "./templates";

const nowTimestamp = () => new Date().toISOString();

let close: () => Promise<void>;
let svc: ReturnType<typeof createTemplatesDBService>;
let db: Awaited<ReturnType<typeof createDb>>["db"];
let projectId: string;
let fileId1: string;
let fileId2: string;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;
  svc = createTemplatesDBService(db);

  const timestamp = nowTimestamp();
  projectId = crypto.randomUUID();
  await db
    .insert(projects)
    .values({ id: projectId, name: "Test", shorthand: "T", created_at: timestamp, updated_at: timestamp });

  fileId1 = crypto.randomUUID();
  fileId2 = crypto.randomUUID();
  await db.insert(files).values([
    {
      id: fileId1,
      project_id: projectId,
      file_name: "tpl1.md",
      file_kind: "template",
      storage_path: "/tmp/tpl1",
      size_bytes: 10,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: fileId2,
      project_id: projectId,
      file_name: "tpl2.md",
      file_kind: "template",
      storage_path: "/tmp/tpl2",
      size_bytes: 10,
      created_at: timestamp,
      updated_at: timestamp,
    },
  ]);
};

const createTicketTemplate = async (isDefault = true) =>
  svc.create({
    project_id: projectId,
    name: "ticket",
    template_type: "ticket",
    file_id: fileId1,
    is_default: isDefault,
  });

const createProposalTemplate = async (isDefault = false) =>
  svc.create({
    project_id: projectId,
    name: "proposal",
    template_type: "ticket",
    file_id: fileId2,
    is_default: isDefault,
  });

beforeEach(async () => {
  await setup();
});

afterEach(async () => {
  await close?.();
});

describe("templatesService", () => {
  test("create, list, getByName", async () => {
    const created = await createTicketTemplate();

    expect(created.name).toBe("ticket");
    expect(created.template_type).toBe("ticket");
    expect(created.is_default).toBe(true);

    const fetched = await svc.getByName(projectId, "ticket");
    expect(fetched?.id).toBe(created.id);

    const all = await svc.list(projectId);
    expect(all).toHaveLength(1);
  });

  test("create with is_default unsets previous default", async () => {
    await createTicketTemplate();

    const first = await createProposalTemplate(true);

    expect(first.is_default).toBe(true);

    const previousDefault = await svc.getByName(projectId, "ticket");
    expect(previousDefault?.is_default).toBe(false);
  });

  test("update changes file_id and default", async () => {
    await createTicketTemplate(false);
    await createProposalTemplate(true);

    const result = await svc.update(projectId, "ticket", { file_id: fileId2, is_default: true });
    expect("template" in result).toBe(true);
    if (!("template" in result)) {
      return;
    }

    const updated = result.template!;

    expect(updated.file_id).toBe(fileId2);
    expect(updated.is_default).toBe(true);

    const proposal = await svc.getByName(projectId, "proposal");
    expect(proposal?.is_default).toBe(false);
  });

  test("update returns null for missing template", async () => {
    const result = await svc.update(projectId, "nonexistent", { is_default: true });
    expect(result).toEqual({ error: "not_found" });
  });

  test("remove soft-deletes and hides from list/getByName", async () => {
    await createTicketTemplate();
    await createProposalTemplate();

    const removed = await svc.remove(projectId, "ticket");
    expect(removed).not.toBeNull();
    expect(removed!.name).toBe("ticket");
    expect(removed!.deleted_at).toBeTruthy();

    const fetched = await svc.getByName(projectId, "ticket");
    expect(fetched).toBeNull();

    const all = await svc.list(projectId);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("proposal");
  });

  test("remove returns null for missing template", async () => {
    const result = await svc.remove(projectId, "nonexistent");
    expect(result).toBeNull();
  });

  test("hardRemove permanently deletes a soft-deleted template", async () => {
    await createTicketTemplate();
    await svc.remove(projectId, "ticket");

    const removed = await svc.hardRemove(projectId, "ticket");
    expect(removed).toBe(true);

    // re-creating with the same name should now succeed
    const recreated = await svc.create({
      project_id: projectId,
      name: "ticket",
      template_type: "ticket",
      file_id: fileId1,
    });
    expect(recreated.name).toBe("ticket");
  });

  test("hardRemove returns false when no soft-deleted record exists", async () => {
    const result = await svc.hardRemove(projectId, "nonexistent");
    expect(result).toBe(false);
  });
});
