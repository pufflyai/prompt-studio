import { expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { projects, storage_log_entries } from "../../db/schemas.pg";
import { createOrderedLogStore } from "./ordered-log-store";

test("file-backed log persistence keeps payloads out of SQL and opens only the displayed entries", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const now = new Date().toISOString();
    await db
      .insert(projects)
      .values({ id: "payload-project", name: "Payloads", shorthand: "P", created_at: now, updated_at: now });
    const values = new Map<string, unknown>();
    let opened = 0;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const payloads = {
      async encode(value: unknown) {
        const id = crypto.randomUUID();
        values.set(id, structuredClone(value));
        return encoder.encode(id);
      },
      async decode<T>(bytes: Uint8Array) {
        opened++;
        return structuredClone(values.get(decoder.decode(bytes))) as T;
      },
    };
    const store = createOrderedLogStore(db, {
      owner: { workbenchId: "payload-project", extensionId: "personal" },
      name: "session",
      scope: "session",
      stream: "laptop",
      writerId: "laptop",
      payloads,
    });
    for (let i = 0; i < 3; i++) await store.append(`private transcript ${i}`, { id: `entry-${i}` });
    expect(
      (await db.select().from(storage_log_entries)).every(
        (row) => !decoder.decode(row.entry).includes("private transcript"),
      ),
    ).toBe(true);
    opened = 0;
    expect((await store.read({ newest: true, limit: 1 })).entries[0]?.value).toBe("private transcript 2");
    expect(opened).toBe(1);
  } finally {
    await close();
  }
});
