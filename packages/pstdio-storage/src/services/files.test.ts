import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, projects, tickets } from "pstdio-db";
import { createFilesService } from "./files";

const nowTimestamp = () => new Date().toISOString();

const roots: string[] = [];

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots.length = 0;
});

test("files service supports upload and ticket attachments", async () => {
  const storagePath = mkdtempSync(join(tmpdir(), "pstdio-files-"));
  roots.push(storagePath);

  const { db, close } = await createDb({ path: ":memory:" });
  const files = createFilesService(db, storagePath);

  const timestamp = nowTimestamp();
  const projectId = crypto.randomUUID();
  await db
    .insert(projects)
    .values({ id: projectId, name: "Alpha", shorthand: "A", created_at: timestamp, updated_at: timestamp });

  const ticketId = crypto.randomUUID();
  await db.insert(tickets).values({
    id: ticketId,
    shorthand: "T-1",
    project_id: projectId,
    display_title: "Ticket One",
    created_at: timestamp,
    updated_at: timestamp,
  });

  const uploaded = await files.upload({
    project_id: projectId,
    file_name: "note.txt",
    file_kind: "attachment",
    mime_type: "text/plain",
    data: Buffer.from("hello world"),
  });

  expect(uploaded.project_id).toBe(projectId);
  expect(readFileSync(uploaded.storage_path, "utf8")).toBe("hello world");

  const fetched = await files.get(uploaded.id);
  expect(fetched?.id).toBe(uploaded.id);

  const updated = await files.update(uploaded.id, {
    data: Buffer.from("updated content"),
  });

  expect(updated?.id).toBe(uploaded.id);
  expect(updated?.size_bytes).toBe(Buffer.byteLength("updated content"));
  expect(readFileSync(uploaded.storage_path, "utf8")).toBe("updated content");

  const listBefore = await files.listForTicket(ticketId);
  expect(listBefore).toHaveLength(0);

  const attached = await files.attachToTicket(ticketId, uploaded.id);
  expect(attached?.ticket_id).toBe(ticketId);
  expect(attached?.file_id).toBe(uploaded.id);

  const listAfter = await files.listForTicket(ticketId);
  expect(listAfter).toHaveLength(1);
  expect(listAfter[0]?.id).toBe(uploaded.id);

  const detached = await files.detachFromTicket(ticketId, uploaded.id);
  expect(detached).toBe(true);
  expect(await files.listForTicket(ticketId)).toHaveLength(0);

  const removed = await files.remove(uploaded.id);
  expect(removed).toBe(true);

  await close();
});
