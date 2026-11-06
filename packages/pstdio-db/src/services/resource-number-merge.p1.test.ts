import { expect, test } from "bun:test";
import { createDb } from "../db/connection.pglite";
import { createExtensionResourceSequencesDBService } from "./extension-resource-sequences";
import { createDocumentStorageDBService } from "./extension-storage/document-storage";
import { createProjectsDBService } from "./projects/projects";

const fixture = async () => {
  const connection = await createDb({ path: ":memory:" });
  const project = await createProjectsDBService(connection.db).create({ name: "Prompt Studio" });
  const documents = createDocumentStorageDBService(connection.db);
  const service = createExtensionResourceSequencesDBService(connection.db, documents);
  const owner = { workbenchId: project.id, extensionId: "pstdio" };
  const input = { projectId: project.id, extensionId: "pstdio.planner", kind: "ticket", prefix: "PS" };
  return { ...connection, service, documents, owner, input };
};

// Offline convergence and checkpoint cases use the real encrypted ordered relay in ordered-resource-numbers.p1.test.ts.

test("repair skips occupied numbers and leaves another kind's prefix alone", async () => {
  const f = await fixture();
  try {
    const resources = [
      { id: "a", value: 31 },
      { id: "b", value: 31 },
      { id: "c", value: 32 },
    ].map((r) => ({ ...r, extensionId: f.input.extensionId, kind: "ticket", prefix: "PS", aliases: [] }));
    resources.push({
      id: "report",
      value: 31,
      extensionId: f.input.extensionId,
      kind: "report",
      prefix: "RP",
      aliases: [],
    });
    await f.documents
      .open({ owner: f.owner })
      .records.commit({ operationId: "mixed", edits: resources.map((r) => ({ recordId: r.id, replace: r })) });
    expect((await f.service.identityMany({ ...f.input, ids: ["a", "b", "c"] })).map((r) => r!.shorthand)).toEqual([
      "PS-31",
      "PS-33",
      "PS-32",
    ]);
    expect((await f.service.identity({ ...f.input, kind: "report", id: "report" }))?.shorthand).toBe("RP-31");
  } finally {
    await f.documents.flushStatistics();
    await f.close();
  }
});

test("one shorthand can resolve to several aliases and failed merges publish no event", async () => {
  const f = await fixture();
  try {
    const first = await f.service.allocate(f.input);
    const records = f.documents.open({ owner: f.owner }).records;
    const value = (await records.read(first.id)).value!;
    await records.commit({
      operationId: "duplicates",
      edits: ["x", "y"].map((id) => ({ recordId: id, replace: { ...(value as object), id } })),
    });
    const matches = await f.service.findByShorthand({ ...f.input, shorthand: "PS-1" });
    expect(matches.map((resource) => resource.id)).toEqual([first.id, "x", "y"]);
    expect(matches.slice(1).map((resource) => resource.aliases)).toEqual([["PS-1"], ["PS-1"]]);
    const events: unknown[] = [];
    f.service.watch((event) => events.push(event));
    await expect(
      records.transaction(async (transaction) => {
        await transaction.commit({
          operationId: "aborted",
          edits: [{ recordId: "x", replace: { ...(value as object), id: "x", value: 99 } }],
        });
        throw new Error("aborted merge");
      }),
    ).rejects.toThrow("aborted merge");
    expect(events).toEqual([]);
    expect(await f.service.findByShorthand({ ...f.input, shorthand: "PS-1" })).toEqual(matches);
  } finally {
    await f.close();
  }
});

for (const initialValue of [1, 50]) {
  test(`collision repair preserves the allocation floor after deleting number ${initialValue + 4}`, async () => {
    const f = await fixture();
    try {
      const records = f.documents.open({ owner: f.owner }).records;
      if (initialValue > 1) {
        await records.commit({
          operationId: "import",
          edits: [
            {
              recordId: "imported",
              replace: {
                id: "imported",
                extensionId: f.input.extensionId,
                kind: f.input.kind,
                prefix: "PS",
                value: initialValue - 1,
                aliases: [],
              },
            },
          ],
        });
      }
      const allocated = [];
      for (let index = 0; index < 5; index++) allocated.push(await f.service.allocate(f.input));
      await records.commit({
        operationId: "delete",
        edits: allocated.slice(1).map((resource) => ({ recordId: resource.id, deleted: true })),
      });
      const original = (await records.read(allocated[0]!.id)).value;
      await records.commit({
        operationId: "collision",
        edits: [{ recordId: "z", replace: { ...(original as object), id: "z" } }],
      });
      expect((await f.service.identity({ ...f.input, id: "z" }))?.shorthand).toBe(`PS-${initialValue + 5}`);
      await records.commit({ operationId: "delete-repair", edits: [{ recordId: "z", deleted: true }] });
      expect((await f.service.allocate(f.input)).shorthand).toBe(`PS-${initialValue + 6}`);
    } finally {
      await f.documents.flushStatistics();
      await f.close();
    }
  });
}

test("core records with malformed number aliases save without entering the number index", async () => {
  const f = await fixture();
  try {
    const records = f.documents.open({ owner: f.owner }).records;
    const invalid = ["PS-NaN", "PS-Infinity", "PS-1.5", "PS-0", "PS-9007199254740992", "PS-"];
    await records.commit({
      operationId: "malformed-aliases",
      edits: invalid.map((alias, index) => ({
        recordId: `invalid-${index}`,
        replace: {
          id: `invalid-${index}`,
          extensionId: f.input.extensionId,
          kind: f.input.kind,
          prefix: "PS",
          value: 1,
          aliases: [alias],
        },
      })),
    });
    expect(await records.list()).toHaveLength(invalid.length);
    expect(await f.service.findByShorthand({ ...f.input, shorthand: "PS-1" })).toEqual([]);
    expect((await f.service.allocate(f.input)).shorthand).toBe("PS-1");
  } finally {
    await f.documents.flushStatistics();
    await f.close();
  }
});

test("allocation rejects exhausted number ranges without saving an unindexed resource", async () => {
  const f = await fixture();
  try {
    const records = f.documents.open({ owner: f.owner }).records;
    await records.commit({
      operationId: "large-number",
      edits: [
        {
          recordId: "large",
          replace: {
            id: "large",
            extensionId: f.input.extensionId,
            kind: f.input.kind,
            prefix: "PS",
            value: 2_147_483_648,
            aliases: [],
          },
        },
      ],
    });
    expect((await f.service.allocate(f.input)).shorthand).toBe("PS-2147483649");
    await records.commit({
      operationId: "last-number",
      edits: [
        {
          recordId: "last",
          replace: {
            id: "last",
            extensionId: f.input.extensionId,
            kind: f.input.kind,
            prefix: "PS",
            value: Number.MAX_SAFE_INTEGER,
            aliases: [],
          },
        },
      ],
    });
    const savedCount = (await records.list()).length;
    for (let attempt = 0; attempt < 2; attempt++) {
      const error = await f.service.allocate(f.input).catch((error: unknown) => error);
      expect(error).toMatchObject({ message: "Resource number range exhausted for prefix PS" });
    }
    expect(await records.list()).toHaveLength(savedCount);
  } finally {
    await f.documents.flushStatistics();
    await f.close();
  }
});

test("an alias raises only the allocation floor for its own prefix", async () => {
  const f = await fixture();
  try {
    await f.documents.open({ owner: f.owner }).records.commit({
      operationId: "former-prefix",
      edits: [
        {
          recordId: "old",
          replace: {
            id: "old",
            extensionId: f.input.extensionId,
            kind: f.input.kind,
            prefix: "PS",
            value: 1,
            aliases: ["OLD-50"],
          },
        },
      ],
    });
    expect((await f.service.allocate(f.input)).shorthand).toBe("PS-2");
    expect((await f.service.allocate({ ...f.input, kind: "archived", prefix: "OLD" })).shorthand).toBe("OLD-51");
    expect(
      (await f.service.findByShorthand({ ...f.input, shorthand: "OLD-50" })).map((resource) => resource.id),
    ).toEqual(["old"]);
  } finally {
    await f.documents.flushStatistics();
    await f.close();
  }
});
