import { expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { coreOwnerId } from "pstdio-sync/records";
import { createRecordStreamSync } from "pstdio-sync/relay";
import { type Json, type RecordEdit, storageLimits, storageRecordBytes } from "pstdio-sync-contracts";
import { createDb } from "../db/connection.pglite";
import { projects } from "../db/schemas.pg";
import { createExtensionResourceSequencesDBService } from "./extension-resource-sequences";
import { createDocumentStorageDBService } from "./extension-storage/document-storage";
import { createRelay } from "./extension-storage/record-stream-relay.fixture";

const pair = async (count = 2) => {
  const projectId = crypto.randomUUID();
  const owner = { workbenchId: projectId, extensionId: coreOwnerId };
  const input = { projectId, extensionId: "pstdio.planner", kind: "ticket", prefix: "PS" };
  const space = await createSyncSpace({
    projectId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const { relay } = createRelay();
  const documentId = await space.documentId(JSON.stringify([coreOwnerId, "record-stream"]));
  const devices = await Promise.all(
    Array.from({ length: count }, async () => {
      const connection = await createDb({ path: ":memory:" });
      const now = new Date().toISOString();
      await connection.db
        .insert(projects)
        .values({ id: projectId, name: "Numbers", shorthand: "P", created_at: now, updated_at: now });
      const documents = createDocumentStorageDBService(connection.db);
      const numbers = createExtensionResourceSequencesDBService(connection.db, documents);
      const records = documents.open({ owner }).records;
      const failures: unknown[] = [];
      const sync = createRecordStreamSync({
        space,
        documentId,
        relay,
        store: numbers.recordStream(projectId),
        quarantine: async (error) => {
          failures.push(error);
        },
      });
      return { ...connection, documents, numbers, records, sync, failures };
    }),
  );
  return {
    relay,
    space,
    documentId,
    devices,
    input,
    owner,
    close: async () => {
      for (const device of devices) {
        await device.documents.flushStatistics();
        await device.close();
      }
    },
  };
};
const numbered = (id: string, value: number, aliases: string[] = []) => ({
  id,
  extensionId: "pstdio.planner",
  kind: "ticket",
  prefix: "PS",
  value,
  aliases,
});

test("ordered resource allocation keeps its local floor and converges offline collisions with aliases", async () => {
  const f = await pair();
  try {
    const [first, second] = f.devices;
    await first!.records.commit({ operationId: "first", edits: [{ recordId: "a", replace: numbered("a", 1) }] });
    await second!.records.commit({ operationId: "second", edits: [{ recordId: "z", replace: numbered("z", 1) }] });
    const events: unknown[] = [];
    second!.numbers.watch((event) => events.push(event));
    expect((await first!.numbers.allocate(f.input)).shorthand).toBe("PS-2");
    await first!.sync.synchronize();
    await second!.sync.synchronize();
    await first!.sync.synchronize();
    for (const device of f.devices) {
      expect(await device.numbers.identity({ ...f.input, id: "a" })).toMatchObject({ shorthand: "PS-1" });
      expect(await device.numbers.identity({ ...f.input, id: "z" })).toMatchObject({
        shorthand: "PS-3",
        aliases: ["PS-1"],
      });
      expect(
        (await device.numbers.findByShorthand({ ...f.input, shorthand: "PS-1" })).map((value) => value.id),
      ).toEqual(["a", "z"]);
      expect(device.failures).toEqual([]);
    }
    expect(events).toContainEqual(
      expect.objectContaining({
        previousShorthand: "PS-1",
        shorthand: "PS-3",
        resource: expect.objectContaining({ id: "z" }),
      }),
    );
  } finally {
    await f.close();
  }
});

test("canonical repairs preserve an independently shown optimistic alias", async () => {
  const f = await pair();
  try {
    const [first, second] = f.devices;
    await first!.records.commit({ operationId: "seed", edits: [{ recordId: "z", replace: numbered("z", 1) }] });
    await first!.sync.synchronize();
    await second!.sync.synchronize();
    await first!.records.commit({
      operationId: "higher",
      edits: [{ recordId: "higher", replace: numbered("higher", 10) }],
    });
    await second!.records.commit({ operationId: "winner", edits: [{ recordId: "a", replace: numbered("a", 1) }] });
    expect(await second!.numbers.identity({ ...f.input, id: "z" })).toMatchObject({
      shorthand: "PS-2",
      aliases: ["PS-1"],
    });
    await first!.sync.synchronize();
    await second!.sync.synchronize();
    await first!.sync.synchronize();
    for (const device of f.devices) {
      expect(await device.numbers.identity({ ...f.input, id: "z" })).toMatchObject({
        shorthand: "PS-11",
        aliases: ["PS-1", "PS-2"],
      });
      expect(
        (await device.numbers.findByShorthand({ ...f.input, shorthand: "PS-2" })).map((value) => value.id),
      ).toEqual(["z"]);
    }
  } finally {
    await f.close();
  }
});

test("a first tombstone download retains prefix floors and arbitrary core JSON stays outside number indexes", async () => {
  const f = await pair();
  try {
    const [first, second] = f.devices;
    await first!.records.commit({
      operationId: "historical",
      edits: [{ recordId: "gone", replace: numbered("gone", 1, ["PS-50", "OLD-75"]) }],
    });
    await first!.records.commit({ operationId: "remove", edits: [{ recordId: "gone", deleted: true }] });
    await first!.records.commit({
      operationId: "other",
      edits: [
        { recordId: "json", replace: { "\0": [null, "text\0value", 1] } },
        { recordId: "unindexed", replace: { ...numbered("unindexed", 1), prefix: "\0" } },
        { recordId: "unpaired", replace: { ...numbered("unpaired", 1), kind: "\ud800" } },
      ],
    });
    await first!.sync.synchronize();
    await second!.sync.synchronize();
    expect(await second!.numbers.identity({ ...f.input, id: "gone" })).toBeNull();
    expect((await second!.numbers.allocate(f.input)).shorthand).toBe("PS-51");
    expect((await second!.numbers.allocate({ ...f.input, kind: "archived", prefix: "OLD" })).shorthand).toBe("OLD-76");
    expect((await second!.records.read("json")).value).toEqual({ "\0": [null, "text\0value", 1] });
    expect((await second!.records.read("unindexed")).value).toEqual({ ...numbered("unindexed", 1), prefix: "\0" });
    expect((await second!.records.read("unpaired")).value).toEqual({ ...numbered("unpaired", 1), kind: "\ud800" });
    expect(await second!.numbers.findByShorthand({ ...f.input, shorthand: "OLD-75" })).toEqual([]);
  } finally {
    await f.close();
  }
});

test("canonical number repair ignores this replica's unsubmitted higher allocation", async () => {
  const f = await pair();
  try {
    const [first, second] = f.devices;
    await first!.records.commit({ operationId: "seed", edits: [{ recordId: "z", replace: numbered("z", 1) }] });
    await first!.sync.synchronize();
    await second!.sync.synchronize();
    await first!.records.commit({
      operationId: "pending-higher",
      edits: [{ recordId: "higher", replace: numbered("higher", 10) }],
    });
    await second!.records.commit({ operationId: "winner", edits: [{ recordId: "a", replace: numbered("a", 1) }] });
    const before = await second!.records.read("z");
    await second!.records.commit({
      operationId: "matching-observation",
      edits: [{ recordId: "z", expectedRevision: before.revision, set: { "/value": 2 } }],
    });
    await second!.sync.synchronize();
    await first!.sync.synchronize();
    await second!.sync.synchronize();
    for (const device of f.devices)
      expect(await device.numbers.identity({ ...f.input, id: "z" })).toMatchObject({
        shorthand: "PS-2",
        aliases: ["PS-1"],
      });
    expect((await second!.records.outcome("matching-observation"))?.state).toBe("synced");
  } finally {
    await f.close();
  }
});

test("resource number changes and events roll back together and replacing a number retains its floor", async () => {
  const f = await pair();
  try {
    const [first, second] = f.devices;
    await first!.records.commit({
      operationId: "number",
      edits: [{ recordId: "number", replace: numbered("number", 8, ["PS-50"]) }],
    });
    const events: unknown[] = [];
    first!.numbers.watch((event) => events.push(event));
    await expect(
      first!.records.transaction(async (records) => {
        await records.commit({
          operationId: "rolled-back",
          edits: [{ recordId: "number", replace: numbered("number", 99) }],
        });
        throw new Error("rolled back");
      }),
    ).rejects.toThrow("rolled back");
    expect(events).toEqual([]);
    expect(await first!.numbers.identity({ ...f.input, id: "number" })).toMatchObject({
      shorthand: "PS-8",
      aliases: ["PS-50"],
    });
    await first!.records.commit({
      operationId: "settings",
      edits: [{ recordId: "number", replace: { title: "settings" } }],
    });
    await first!.sync.synchronize();
    await second!.sync.synchronize();
    expect(await second!.numbers.identity({ ...f.input, id: "number" })).toBeNull();
    expect((await second!.numbers.allocate(f.input)).shorthand).toBe("PS-51");
  } finally {
    await f.close();
  }
});

test("three offline number claims converge in one order with every replaced claim retained as an alias", async () => {
  const f = await pair(3);
  try {
    for (const [index, device] of f.devices.entries()) {
      const id = ["c", "b", "a"][index]!;
      await device.records.commit({ operationId: id, edits: [{ recordId: id, replace: numbered(id, 31) }] });
    }
    for (const device of f.devices) await device.sync.synchronize();
    // The final device admits the final offline claim; earlier replicas now receive that suffix.
    await f.devices[0]!.sync.synchronize();
    await f.devices[1]!.sync.synchronize();
    const expected = await f.devices[2]!.numbers.identityMany({ ...f.input, ids: ["a", "b", "c"] });
    expect(new Set(expected.map((value) => value!.shorthand)).size).toBe(3);
    expect(expected[0]!.shorthand).toBe("PS-31");
    expect(expected[1]!.aliases).toContain("PS-31");
    expect(expected[2]!.aliases).toContain("PS-31");
    for (const device of f.devices)
      expect(await device.numbers.identityMany({ ...f.input, ids: ["a", "b", "c"] })).toEqual(expected);
  } finally {
    await f.close();
  }
});

test("an exhausted canonical number collision refuses its whole group and later ordered saves continue", async () => {
  const f = await pair();
  try {
    const [first, second] = f.devices;
    await first!.records.commit({
      operationId: "first-max",
      edits: [{ recordId: "a", replace: numbered("a", Number.MAX_SAFE_INTEGER) }],
    });
    await second!.records.commit({
      operationId: "second-max",
      edits: [
        { recordId: "z", replace: numbered("z", Number.MAX_SAFE_INTEGER) },
        { recordId: "audit", replace: "must remain absent" },
      ],
    });
    await first!.sync.synchronize();
    await second!.sync.synchronize();
    await first!.sync.synchronize();
    expect((await second!.records.outcome("second-max"))?.state).toBe("refused");
    for (const device of f.devices) {
      expect((await device.records.read("z")).exists).toBe(false);
      expect((await device.records.read("audit")).exists).toBe(false);
      expect(await device.numbers.identity({ ...f.input, id: "a" })).toMatchObject({
        shorthand: `PS-${Number.MAX_SAFE_INTEGER}`,
      });
    }
    await second!.records.commit({
      operationId: "progress",
      edits: [{ recordId: "settings", replace: { enabled: true } }],
    });
    await second!.sync.synchronize();
    await first!.sync.synchronize();
    expect((await first!.records.read("settings")).value).toEqual({ enabled: true });
  } finally {
    await f.close();
  }
});

test("an exhausted pending floor cannot block an earlier incoming canonical number", async () => {
  const f = await pair();
  try {
    const [first, second] = f.devices;
    await first!.records.commit({
      operationId: "local",
      edits: [
        { recordId: "z", replace: numbered("z", 1) },
        { recordId: "audit-local", replace: "atomic" },
      ],
    });
    const audit = await first!.records.read("audit-local");
    await first!.records.commit({
      operationId: "local-child",
      edits: [{ recordId: "audit-local", expectedRevision: audit.revision, replace: "child" }],
    });
    await first!.records.commit({
      operationId: "local-higher",
      edits: [{ recordId: "higher", replace: numbered("higher", Number.MAX_SAFE_INTEGER) }],
    });
    await second!.records.commit({ operationId: "incoming", edits: [{ recordId: "a", replace: numbered("a", 1) }] });
    await second!.sync.synchronize();
    const paused = createRecordStreamSync({
      space: f.space,
      documentId: f.documentId,
      relay: {
        ...f.relay,
        update: async () => {
          throw new Error("Pause before authored admission");
        },
      },
      store: first!.numbers.recordStream(f.input.projectId),
      quarantine: async (failure) => {
        first!.failures.push(failure);
      },
    });
    await expect(paused.synchronize()).rejects.toThrow("Pause before authored admission");
    expect((await first!.records.read("z")).exists).toBe(false);
    expect((await first!.records.read("audit-local")).exists).toBe(false);
    expect((await first!.records.outcome("local"))?.state).toBe("saved-locally");
    expect((await first!.records.outcome("local-child"))?.state).toBe("saved-locally");
    await first!.sync.synchronize();
    await second!.sync.synchronize();
    for (const device of f.devices) {
      expect(await device.numbers.identity({ ...f.input, id: "a" })).toMatchObject({ shorthand: "PS-1" });
      expect(await device.numbers.identity({ ...f.input, id: "z" })).toMatchObject({
        shorthand: "PS-2",
        aliases: ["PS-1"],
      });
      expect(await device.numbers.identity({ ...f.input, id: "higher" })).toMatchObject({
        shorthand: `PS-${Number.MAX_SAFE_INTEGER}`,
      });
      expect((await device.records.read("audit-local")).value).toBe("child");
    }
  } finally {
    await f.close();
  }
});

const paddedNumberValue = (value: Record<string, Json>, bytes: number) => {
  const padded = { ...value, padding: "" };
  padded.padding = "x".repeat(bytes - storageRecordBytes({ value: padded, shared: null }));
  return padded;
};

const numberBoundary = (limit: "record" | "group") => {
  const large = paddedNumberValue(numbered("z", 1), storageLimits.recordBytes - (limit === "group" ? 13 : 0));
  const edits: (RecordEdit & { replace: Json })[] = [
    { recordId: "a", replace: numbered("a", 1) },
    { recordId: "audit-boundary", replace: { message: "atomic" } },
  ];
  if (limit === "group") {
    let remaining = storageLimits.commitBytes - storageRecordBytes({ value: large, shared: null });
    for (const edit of edits) remaining -= storageRecordBytes({ value: edit.replace, shared: null });
    for (let index = 0; index < 15; index++) {
      const bytes = Math.min(storageLimits.recordBytes, remaining - (14 - index) * 30);
      edits.push({ recordId: `padding-${index}`, replace: paddedNumberValue({}, bytes) });
      remaining -= bytes;
    }
    expect(remaining).toBe(0);
  }
  return { large, edits };
};

for (const limit of ["record", "group"] as const) {
  test(`number repair crossing the ${limit} limit suppresses pending optimism and refuses the atomic group`, async () => {
    const f = await pair();
    try {
      const [first, second] = f.devices;
      const { large, edits } = numberBoundary(limit);
      await first!.records.commit({ operationId: "canonical-large", edits: [{ recordId: "z", replace: large }] });
      await second!.records.commit({ operationId: "bounded-competitor", edits });
      const audit = await second!.records.read("audit-boundary");
      await second!.records.commit({
        operationId: "bounded-child",
        edits: [{ recordId: "audit-boundary", expectedRevision: audit.revision, replace: { message: "child" } }],
      });
      await first!.sync.synchronize();
      const paused = createRecordStreamSync({
        space: f.space,
        documentId: f.documentId,
        relay: {
          ...f.relay,
          update: async () => {
            throw new Error("Pause boundary admission");
          },
        },
        store: second!.numbers.recordStream(f.input.projectId),
        quarantine: async (failure) => {
          second!.failures.push(failure);
        },
      });
      await expect(paused.synchronize()).rejects.toThrow("Pause boundary admission");
      expect((await second!.records.read("z")).value).toEqual(large);
      expect((await second!.records.read("a")).exists).toBe(false);
      expect((await second!.records.read("audit-boundary")).exists).toBe(false);
      expect((await second!.records.outcome("bounded-competitor"))?.state).toBe("saved-locally");
      expect((await second!.records.outcome("bounded-child"))?.state).toBe("saved-locally");
      await second!.sync.synchronize();
      await first!.sync.synchronize();
      expect((await second!.records.outcome("bounded-competitor"))?.state).toBe("refused");
      expect((await second!.records.outcome("bounded-child"))?.state).toBe("refused");
      for (const device of f.devices) {
        expect((await device.records.read("z")).value).toEqual(large);
        expect((await device.records.read("a")).exists).toBe(false);
        expect((await device.records.read("audit-boundary")).exists).toBe(false);
        if (limit === "group") expect((await device.records.read("padding-0")).exists).toBe(false);
        expect(device.failures).toEqual([]);
      }
      await second!.records.commit({
        operationId: "boundary-progress",
        edits: [{ recordId: "settings", replace: true }],
      });
      await second!.sync.synchronize();
      await first!.sync.synchronize();
      expect((await first!.records.read("settings")).value).toBe(true);
      expect((await second!.numbers.allocate(f.input)).shorthand).toBe("PS-2");
    } finally {
      await f.close();
    }
  });
}

for (const limit of ["record", "group"] as const) {
  test(`founding refuses a number repair crossing the ${limit} limit without poisoning its snapshot`, async () => {
    const f = await pair();
    try {
      const [first, second] = f.devices;
      const { large, edits } = numberBoundary(limit);
      await first!.records.commit({ operationId: "founding-large", edits: [{ recordId: "z", replace: large }] });
      await first!.records.commit({ operationId: "founding-competitor", edits });
      await first!.sync.synchronize();
      await second!.sync.synchronize();
      expect((await first!.records.outcome("founding-competitor"))?.state).toBe("refused");
      for (const device of f.devices) {
        expect((await device.records.read("z")).value).toEqual(large);
        expect((await device.records.read("a")).exists).toBe(false);
        expect((await device.records.read("audit-boundary")).exists).toBe(false);
        expect(device.failures).toEqual([]);
      }
      await second!.records.commit({
        operationId: "founding-progress",
        edits: [{ recordId: "settings", replace: true }],
      });
      await second!.sync.synchronize();
      await first!.sync.synchronize();
      expect((await first!.records.read("settings")).value).toBe(true);
      expect((await second!.numbers.allocate(f.input)).shorthand).toBe("PS-2");
    } finally {
      await f.close();
    }
  });
}

test("independent number groups may together exceed one commit budget", async () => {
  const f = await pair();
  try {
    const [first, second] = f.devices;
    for (let group = 0; group < 2; group++) {
      const edits = Array.from({ length: 9 }, (_, index) => ({
        recordId: `large-${group}-${index}`,
        replace: paddedNumberValue(
          numbered(`large-${group}-${index}`, group * 9 + index + 1),
          storageLimits.recordBytes,
        ),
      }));
      await first!.records.commit({ operationId: `independent-${group}`, edits });
    }
    await first!.sync.synchronize();
    await second!.sync.synchronize();
    expect((await first!.records.outcome("independent-0"))?.state).toBe("synced");
    expect((await first!.records.outcome("independent-1"))?.state).toBe("synced");
    expect((await second!.records.read("large-1-8")).exists).toBe(true);
    expect((await second!.numbers.allocate(f.input)).shorthand).toBe("PS-19");
    expect(second!.failures).toEqual([]);
  } finally {
    await f.close();
  }
});

test("a later independent enlargement does not spend an earlier group's byte budget", async () => {
  const f = await pair();
  try {
    const [first, second] = f.devices;
    const edits = Array.from({ length: 17 }, (_, index) => ({
      recordId: `shared-budget-${index}`,
      replace: paddedNumberValue({}, index < 15 ? storageLimits.recordBytes : 100),
    }));
    await first!.records.commit({ operationId: "earlier-budget", edits });
    await first!.records.commit({
      operationId: "later-budget",
      edits: [{ recordId: "shared-budget-15", replace: paddedNumberValue({}, storageLimits.recordBytes) }],
    });
    expect((await first!.records.read("shared-budget-0")).exists).toBe(true);
    expect((await first!.records.read("shared-budget-16")).exists).toBe(true);
    await first!.sync.synchronize();
    await second!.sync.synchronize();
    expect((await first!.records.outcome("earlier-budget"))?.state).toBe("synced");
    expect((await first!.records.outcome("later-budget"))?.state).toBe("synced");
    expect((await second!.records.read("shared-budget-0")).exists).toBe(true);
    expect((await second!.records.read("shared-budget-16")).exists).toBe(true);
  } finally {
    await f.close();
  }
});
