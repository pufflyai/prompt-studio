import { expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { documentFilesFor } from "./document-files";
import { withOrderedOwner } from "./ordered-journal";
import { readOrderedMarker, saveOrderedMarker } from "./ordered-native-metadata";

test("a read-only marker refresh follows a replaced generation collected during its file read", async () => {
  const connection = await createDb({ path: ":memory:" });
  const owner = { workbenchId: "marker-read", extensionId: "example.records" };
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered = () => {};
  const paused = new Promise<void>((resolve) => {
    entered = resolve;
  });
  try {
    const now = new Date().toISOString();
    await connection.db
      .insert(projects)
      .values({ id: owner.workbenchId, name: "Markers", shorthand: "MR", created_at: now, updated_at: now });
    await withOrderedOwner(connection.db, owner, (_journal, tx) =>
      saveOrderedMarker(tx, owner, "marker", { state: "old" }),
    );
    const files = documentFilesFor(connection.db);
    const read = files.read;
    let first = true;
    files.read = async (...args) => {
      if (first && args[2] === "state") {
        first = false;
        entered();
        await gate;
      }
      return read(...args);
    };
    const reading = readOrderedMarker<{ state: string }>(connection.db, owner, "marker");
    await paused;
    await withOrderedOwner(connection.db, owner, (_journal, tx) =>
      saveOrderedMarker(tx, owner, "marker", { state: "new" }),
    );
    release();
    expect((await reading)?.value).toEqual({ state: "new" });
    files.read = read;
    const failure = new Error("Unreadable current marker");
    files.read = async () => {
      throw failure;
    };
    await expect(readOrderedMarker(connection.db, owner, "marker")).rejects.toBe(failure);
    files.read = read;
  } finally {
    release();
    await connection.close();
  }
});
