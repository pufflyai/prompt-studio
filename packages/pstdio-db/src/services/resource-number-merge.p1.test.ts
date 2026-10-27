import { expect, test } from "bun:test";
import type { Json } from "pstdio-sync-contracts";
import { createDb } from "../db/connection.pglite";
import { storage_record_projections } from "../db/schemas.pg";
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

test("joining a stream uploads a complete new local identity when the join renumbers it", async () => {
  const first = await fixture();
  const joining = await fixture();
  try {
    for (const [f, id] of [
      [first, "a"],
      [joining, "z"],
    ] as const) {
      await f.documents.open({ owner: f.owner }).records.commit({
        operationId: id,
        edits: [
          {
            recordId: id,
            replace: { id, extensionId: f.input.extensionId, kind: "ticket", prefix: "PS", value: 1, aliases: [] },
          },
        ],
      });
    }
    const firstStream = first.service.recordStream(first.input.projectId);
    const state = new Map((await firstStream.snapshot()).records.map((record) => [record.recordId, [record.bytes]]));
    const joiningStream = joining.service.recordStream(joining.input.projectId);
    await joiningStream.merge(state, "adopt", await joiningStream.open());
    const [entry] = await joiningStream.outbox(1);
    await firstStream.apply([{ records: entry!.records, assets: [] }], await firstStream.open());
    expect(await first.service.identity({ ...first.input, id: "z" })).toMatchObject({
      shorthand: "PS-2",
      aliases: ["PS-1"],
    });
    expect((await first.db.select().from(storage_record_projections))[0]!.live_count).toBe(2);
    expect(await joiningStream.outbox(1_048_576)).toHaveLength(1);
  } finally {
    for (const f of [first, joining]) {
      await f.documents.flushStatistics();
      await f.close();
    }
  }
});

test("the first outbox frame carries a complete local save including its number repairs", async () => {
  const first = await fixture();
  const second = await fixture();
  try {
    const outgoing = first.service.recordStream(first.input.projectId);
    await outgoing.open();
    await first.documents.open({ owner: first.owner }).records.commit({
      operationId: "duplicates",
      edits: ["a", "z"].map((id) => ({
        recordId: id,
        replace: { id, extensionId: first.input.extensionId, kind: "ticket", prefix: "PS", value: 1, aliases: [] },
      })),
    });
    const entries = await outgoing.outbox(1_048_576);
    const incoming = second.service.recordStream(second.input.projectId);
    const cursor = await incoming.open();
    await incoming.apply([{ records: entries[0]!.records, assets: [] }], { ...cursor, after: 1 });
    expect((await second.service.identityMany({ ...second.input, ids: ["a", "z"] })).map((r) => r?.shorthand)).toEqual([
      "PS-1",
      "PS-2",
    ]);
    expect((await second.db.select().from(storage_record_projections))[0]!.live_count).toBe(2);
    expect(entries).toHaveLength(1);
    expect(await incoming.outbox(1_048_576)).toHaveLength(0);
  } finally {
    for (const f of [first, second]) {
      await f.documents.flushStatistics();
      await f.close();
    }
  }
});

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

test("three offline repairs converge and retain aliases from each repair", async () => {
  const devices = [await fixture(), await fixture(), await fixture()];
  const snapshot = async (f: (typeof devices)[number]) =>
    new Map(
      (await f.service.recordStream(f.input.projectId).snapshot()).records.map((record) => [
        record.recordId,
        [record.bytes],
      ]),
    );
  const receive = async (f: (typeof devices)[number], state: Map<string, Uint8Array[]>) => {
    const store = f.service.recordStream(f.input.projectId);
    await store.merge(state, "repair", await store.open());
  };
  const identity = (f: (typeof devices)[number]) => f.service.identityMany({ ...f.input, ids: ["a", "b", "c"] });
  try {
    for (const [index, f] of devices.entries()) {
      const id = ["c", "b", "a"][index]!;
      await f.documents.open({ owner: f.owner }).records.commit({
        operationId: id,
        edits: [
          {
            recordId: id,
            replace: { id, extensionId: f.input.extensionId, kind: "ticket", prefix: "PS", value: 31, aliases: [] },
          },
        ],
      });
    }
    const offline = await Promise.all(devices.map(snapshot));
    for (const [index, f] of devices.entries()) await receive(f, offline[(index + 1) % 3]!);
    for (let round = 0; round < 3; round++) {
      const states = await Promise.all(devices.map(snapshot));
      for (const f of devices) for (const state of states) await receive(f, state);
    }
    const expected = await identity(devices[0]!);
    for (const f of devices) {
      expect(await identity(f)).toEqual(expected);
      expect(new Set(expected.map((value) => value!.shorthand)).size).toBe(3);
    }
    expect(expected[0]!.shorthand).toBe("PS-31");
    expect(expected[1]!.aliases).toContain("PS-31");
    expect(expected[2]!.aliases).toContain("PS-32");
  } finally {
    for (const f of devices) {
      await f.documents.flushStatistics();
      await f.close();
    }
  }
});

test("crossed repairs keep every number shown on either device as an alias", async () => {
  const first = await fixture();
  const second = await fixture();
  const winner = await fixture();
  const snapshot = async (f: typeof first) =>
    new Map(
      (await f.service.recordStream(f.input.projectId).snapshot()).records.map((record) => [
        record.recordId,
        [record.bytes],
      ]),
    );
  const receive = async (f: typeof first, state: Map<string, Uint8Array[]>) => {
    const stream = f.service.recordStream(f.input.projectId);
    await stream.merge(state, "repair", await stream.open());
  };
  const write = (f: typeof first, id: string, value: number) =>
    f.documents.open({ owner: f.owner }).records.commit({
      operationId: id,
      edits: [
        {
          recordId: id,
          replace: { id, extensionId: f.input.extensionId, kind: f.input.kind, prefix: "PS", value, aliases: [] },
        },
      ],
    });
  try {
    await write(first, "z", 1);
    await receive(second, await snapshot(first));
    await write(first, "higher", 10);
    await write(winner, "a", 1);
    const incoming = await snapshot(winner);
    await receive(first, incoming);
    await receive(second, incoming);
    expect((await first.service.identity({ ...first.input, id: "z" }))?.shorthand).toBe("PS-11");
    expect((await second.service.identity({ ...second.input, id: "z" }))?.shorthand).toBe("PS-2");
    const states = await Promise.all([snapshot(first), snapshot(second)]);
    await receive(first, states[1]!);
    await receive(second, states[0]!);
    for (const f of [first, second]) {
      const identity = await f.service.identity({ ...f.input, id: "z" });
      expect([identity?.shorthand, ...identity!.aliases].sort()).toEqual(["PS-1", "PS-11", "PS-2"]);
      expect((await f.service.findByShorthand({ ...f.input, shorthand: "PS-11" })).some((r) => r.id === "z")).toBe(
        true,
      );
      expect((await f.service.allocate(f.input)).shorthand).toBe("PS-12");
    }
  } finally {
    for (const f of [first, second, winner]) {
      await f.documents.flushStatistics();
      await f.close();
    }
  }
});

test("offline number collisions merge durably with aliases and notify after commit", async () => {
  const first = await fixture();
  const second = await fixture();
  try {
    for (let i = 0; i < 30; i++) await first.service.allocate(first.input);
    const exportState = async (f: typeof first) =>
      new Map(
        (await f.service.recordStream(f.input.projectId).snapshot()).records.map((record) => [
          record.recordId,
          [record.bytes],
        ]),
      );
    const receive = async (f: typeof first, state: Map<string, Uint8Array[]>) => {
      const stream = f.service.recordStream(f.input.projectId);
      await stream.merge(state, "repair", await stream.open());
    };
    await receive(second, await exportState(first));
    const a = await first.service.allocate(first.input);
    const b = await second.service.allocate(second.input);
    expect(a.shorthand).toBe("PS-31");
    expect(b.shorthand).toBe("PS-31");
    const events: unknown[] = [];
    first.service.watch((event) => events.push(event));
    const updates = await Promise.all([exportState(first), exportState(second)]);
    await receive(first, updates[1]);
    await receive(second, updates[0]);
    const [winner, loser] = [a, b].sort((x, y) => (x.id < y.id ? -1 : 1));
    for (const f of [first, second]) {
      expect(await f.service.identity({ ...f.input, id: winner!.id })).toEqual({
        id: winner!.id,
        kind: "ticket",
        shorthand: "PS-31",
        aliases: [],
      });
      expect(await f.service.identity({ ...f.input, id: loser!.id })).toEqual({
        id: loser!.id,
        kind: "ticket",
        shorthand: "PS-32",
        aliases: ["PS-31"],
      });
      expect((await f.service.findByShorthand({ ...f.input, shorthand: "PS-31" })).map((r) => r.id)).toEqual([
        winner!.id,
        loser!.id,
      ]);
      expect((await f.service.allocate(f.input)).shorthand).toBe("PS-33");
    }
    expect(events).toContainEqual(
      expect.objectContaining({
        previousShorthand: "PS-31",
        shorthand: "PS-32",
        resource: expect.objectContaining({ id: loser!.id }),
      }),
    );
    const reopened = createExtensionResourceSequencesDBService(first.db);
    expect((await reopened.identity({ ...first.input, id: loser!.id }))?.shorthand).toBe("PS-32");
    expect(await reopened.identity({ ...first.input, kind: "report", id: loser!.id })).toBeNull();
  } finally {
    await first.close();
    await second.close();
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

test("core records of other shapes save and sync alongside resource numbers", async () => {
  const first = await fixture();
  const second = await fixture();
  try {
    const allocated = await first.service.allocate(first.input);
    const records = first.documents.open({ owner: first.owner }).records;
    const values: Json[] = [null, "note", [1, 2], { title: "Project settings" }, { id: "incomplete", value: 3 }];
    await records.commit({
      operationId: "generic-core-records",
      edits: values.map((replace, index) => ({ recordId: `other-${index}`, replace })),
    });
    const events: unknown[] = [];
    first.service.watch((event) => events.push(event));
    await records.commit({
      operationId: "replace-number-with-settings",
      edits: [{ recordId: allocated.id, replace: { title: "No longer numbered" } }],
    });
    expect(events).toEqual([]);
    expect(await first.service.identity({ ...first.input, id: allocated.id })).toBeNull();
    const snapshot = await first.service.recordStream(first.input.projectId).snapshot();
    const incoming = second.service.recordStream(second.input.projectId);
    await incoming.merge(
      new Map(snapshot.records.map((record) => [record.recordId, [record.bytes]])),
      "adopt",
      await incoming.open(),
    );
    const received = second.documents.open({ owner: second.owner }).records;
    expect((await received.readMany(values.map((_, index) => `other-${index}`))).map((record) => record.value)).toEqual(
      values,
    );
    expect((await received.read(allocated.id)).value).toEqual({ title: "No longer numbered" });
    expect((await first.service.allocate(first.input)).shorthand).toBe("PS-2");
  } finally {
    for (const f of [first, second]) {
      await f.documents.flushStatistics();
      await f.close();
    }
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

test("a downloaded number and its alias keep their floor after deletion before the first allocation", async () => {
  const first = await fixture();
  const second = await fixture();
  try {
    await first.documents.open({ owner: first.owner }).records.commit({
      operationId: "remote-number",
      edits: [
        {
          recordId: "remote",
          replace: {
            id: "remote",
            extensionId: first.input.extensionId,
            kind: first.input.kind,
            prefix: "PS",
            value: 1,
            aliases: ["PS-50"],
          },
        },
      ],
    });
    const snapshot = await first.service.recordStream(first.input.projectId).snapshot();
    const incoming = second.service.recordStream(second.input.projectId);
    await incoming.merge(
      new Map(snapshot.records.map((record) => [record.recordId, [record.bytes]])),
      "adopt",
      await incoming.open(),
    );
    await second.documents.open({ owner: second.owner }).records.commit({
      operationId: "delete-remote",
      edits: [{ recordId: "remote", deleted: true }],
    });
    expect((await second.service.allocate(second.input)).shorthand).toBe("PS-51");
    await first.documents.open({ owner: first.owner }).records.commit({
      operationId: "large-number",
      edits: [
        {
          recordId: "large",
          replace: {
            id: "large",
            extensionId: first.input.extensionId,
            kind: first.input.kind,
            prefix: "PS",
            value: 2_147_483_648,
            aliases: [],
          },
        },
      ],
    });
    expect((await first.service.allocate(first.input)).shorthand).toBe("PS-2147483649");
  } finally {
    for (const f of [first, second]) {
      await f.documents.flushStatistics();
      await f.close();
    }
  }
});

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
