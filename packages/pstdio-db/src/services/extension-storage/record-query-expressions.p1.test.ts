import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { evaluateStorageExpression, type StorageExpression, type StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("selection fingerprints change for selected projections while ignoring unrelated records and fields", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "fingerprints" };
    for (const records of [
      createDocumentStorageDBService(f.db).open({ owner }).records,
      createMemoryStorage(owner).records,
    ]) {
      await records.defineIndexes([
        { name: "selected", prefix: "selected/", fields: { state: { path: ["state"], type: "string" } } },
      ]);
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "selected/a", replace: { state: "ready", ignored: "old" } },
          { recordId: "other/a", replace: { state: "ready" } },
        ],
      });
      const read = () => records.aggregate({ index: "selected", fingerprint: ["state"] });
      const before = await read();
      await records.commit({
        operationId: "unrelated",
        edits: [
          { recordId: "other/a", replace: { state: "done" } },
          { recordId: "selected/a", replace: { state: "ready", ignored: "new" } },
        ],
      });
      expect((await read()).fingerprint).toBe(before.fingerprint);
      await records.commit({
        operationId: "selected",
        edits: [{ recordId: "selected/a", replace: { state: "done" } }],
      });
      const after = await read();
      expect(after.count).toBe(before.count);
      expect(after.fingerprint).not.toBe(before.fingerprint);
    }
  } finally {
    await f.close();
  }
});

test("expression comparisons preserve numeric types and UTF-16 string order in database and memory", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "comparisons" };
    for (const records of [
      createDocumentStorageDBService(f.db).open({ owner }).records,
      createMemoryStorage(owner).records,
    ]) {
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "a", replace: { a: "😀", b: "\uE000" } },
          { recordId: "b", replace: { a: 10, b: 2 } },
          { recordId: "c", replace: { a: "10", b: 2 } },
        ],
      });
      await records.defineIndexes([
        {
          name: "compare",
          fields: {
            a: { path: ["a"], type: "object", derive: { kind: "expression", expression: { variable: "value" } } },
          },
        },
      ] as never);
      const matched = await records.query({
        index: "compare",
        computed: {
          less: { type: "boolean", expression: { op: "lt", args: [{ literal: "😀" }, { literal: "\uE000" }] } },
          greater: { type: "boolean", expression: { op: "gt", args: [{ literal: 10 }, { literal: 2 }] } },
          mixed: { type: "boolean", expression: { op: "gt", args: [{ literal: "10" }, { literal: 2 }] } },
        },
        fields: ["less", "greater", "mixed"],
        limit: 1,
      });
      expect(matched.records[0].fields).toEqual({ less: true, greater: true, mixed: false });
    }
  } finally {
    await f.close();
  }
});

test("timestamp projections aggregate valid instants without materializing source records", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "dates" };
    for (const records of [
      createDocumentStorageDBService(f.db).open({ owner }).records,
      createMemoryStorage(owner).records,
    ]) {
      await records.commit({
        operationId: "dates",
        edits: ["invalid", "2026-11-14T10:00:00Z", "2026-11-14T09:00:00+02:00"].map((date, index) => ({
          recordId: String(index),
          replace: { date },
        })),
      });
      await records.defineIndexes([
        { name: "dates", fields: { instant: { path: ["date"], type: "number", derive: { kind: "timestamp" } } } },
      ] as never);
      expect(
        (await records.aggregate({ index: "dates", metrics: { earliest: { operation: "min", field: "instant" } } }))
          .metrics?.earliest,
      ).toBe(Date.parse("2026-11-14T07:00:00Z"));
    }
  } finally {
    await f.close();
  }
});

test("computed fields and correlated form answers select before paging and counting", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "forms" };
    const indexes: StorageRecordIndex[] = [
      {
        name: "forms",
        prefix: "form/",
        fields: {
          id: { path: ["id"], type: "string" },
          questions: { path: ["questions"], type: "object" },
        },
      },
      {
        name: "answers",
        prefix: "answer/",
        fields: {
          form: { path: ["form"], type: "string" },
          answers: { path: ["answers"], type: "object" },
        },
      },
    ];
    for (const records of [
      createDocumentStorageDBService(f.db).open({ owner }).records,
      createMemoryStorage(owner).records,
    ]) {
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "form/1", replace: { id: "1", questions: { "réponse\u0000": "accepted" } } },
          { recordId: "form/2", replace: { id: "2", questions: { "réponse\u0000": "accepted" } } },
          { recordId: "answer/1", replace: { form: "1", answers: { "réponse\u0000": "wrong" } } },
          { recordId: "answer/2", replace: { form: "2", answers: { "réponse\u0000": "accepted" } } },
        ],
      });
      await records.defineIndexes(indexes);
      const where = {
        exists: {
          index: "answers",
          on: [{ sourceField: "id", relatedField: "form" }],
          where: {
            test: {
              op: "eq",
              args: [
                { get: { field: "answers" }, key: "réponse\u0000" },
                { get: { field: "questions", up: 1 }, key: "réponse\u0000" },
              ],
            },
          },
        },
      };
      const query = {
        index: "forms",
        where,
        computed: { label: { type: "string", expression: { field: "id" } } },
      } as const;
      const page = await records.query({ ...query, limit: 1, fields: ["label"] } as never);
      expect(page.records.map((r) => r.fields)).toEqual([{ label: "2" }]);
      expect(page.cursor).toBeNull();
      expect((await records.aggregate({ ...query, groupBy: "label" } as never)).groups).toEqual([
        { value: "2", count: 1 },
      ]);
    }
  } finally {
    await f.close();
  }
});

test("recursive breadcrumb search includes deep ancestors and cross-separator matches before LIMIT", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "hierarchy" };
    for (const records of [
      createDocumentStorageDBService(f.db).open({ owner }).records,
      createMemoryStorage(owner).records,
    ]) {
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "a", replace: { id: "a", label: "ROOT", parent: null } },
          { recordId: "b", replace: { id: "b", label: "MIDDLE", parent: "a" } },
          { recordId: "c", replace: { id: "c", label: "LEAF", parent: "b" } },
        ],
      });
      await records.defineIndexes([
        {
          name: "tree",
          fields: {
            id: { path: ["id"], type: "string" },
            parent: { path: ["parent"], type: "string" },
            label: { path: ["label"], type: "string" },
            breadcrumb: { path: ["unused"], type: "string" },
          },
          equality: ["id"],
          hierarchy: {
            idField: "id",
            parentField: "parent",
            labelField: "label",
            breadcrumbField: "breadcrumb",
            separator: " / ",
          },
        },
      ] as never);
      const query = {
        index: "tree",
        where: { field: "breadcrumb", op: "textContains", value: "ROOT / MIDDLE / L" },
        fields: ["id", "breadcrumb"],
        limit: 1,
      } as const;
      expect((await records.query(query as never)).records.map((record) => record.fields)).toEqual([
        { id: "c", breadcrumb: "ROOT / MIDDLE / LEAF" },
      ]);
      expect((await records.aggregate(query as never)).count).toBe(1);
      await records.commit({ operationId: "cycle", edits: [{ recordId: "a", set: { "/parent": "c" } }] });
      expect(
        (await records.query({ index: "tree", where: { field: "id", op: "eq", value: "a" }, fields: ["breadcrumb"] }))
          .records[0].fields.breadcrumb,
      ).toBe("MIDDLE / LEAF / ROOT");
    }
  } finally {
    await f.close();
  }
});

test("core identity eligibility and shorthand changes participate in selection and cursor revisions", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "numbered" };
    const service = createDocumentStorageDBService(f.db);
    const records = service.open({ owner }).records;
    const core = service.open({ owner: { ...owner, extensionId: "pstdio" } }).records;
    await records.commit({
      operationId: "seed",
      edits: ["a", "b", "c"].map((id) => ({ recordId: id, replace: { id } })),
    });
    const number = (id: string, value: number) => ({
      id,
      kind: "thing",
      prefix: "X",
      value,
      extensionId: owner.extensionId,
      aliases: [],
    });
    await core.commit({
      operationId: "numbers",
      edits: [
        { recordId: "b", replace: number("b", 2) },
        { recordId: "c", replace: number("c", 3) },
      ],
    });
    await records.defineIndexes([
      {
        name: "things",
        fields: { id: { path: ["id"], type: "string" }, shorthand: { path: ["unused"], type: "string" } },
        identity: { kind: "thing", idField: "id", shorthandField: "shorthand" },
        orderBy: [{ field: "id", direction: "asc" }],
      },
    ] as never);
    const first = await records.query({ index: "things", limit: 1 });
    expect(first.records.map((record) => record.fields)).toEqual([{ id: "b", shorthand: "X-2" }]);
    expect((await records.aggregate({ index: "things" })).count).toBe(2);
    await core.commit({ operationId: "renumber", edits: [{ recordId: "b", replace: number("b", 8) }] });
    await expect(records.query({ index: "things", limit: 1, cursor: first.cursor! })).rejects.toThrow("stale");
    expect(
      (await records.query({ index: "things", where: { field: "shorthand", op: "eq", value: "X-8" } })).records.map(
        (record) => record.fields.id,
      ),
    ).toEqual(["b"]);
  } finally {
    await f.close();
  }
});

test("JSON expressions retain decoded string, own-key, quantifier and missing-value semantics", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "json-forms" };
    const field = { field: "body" } as const;
    const get = (key: string): StorageExpression => ({ get: field, key });
    const expressions: Record<string, StorageExpression> = {
      blank: { op: "nonblank", args: [get("blank")] },
      text: { op: "nonblank", args: [get("text")] },
      length: { op: "length", args: [get("text")] },
      unique: { op: "unique", args: [get("choices")] },
      required: {
        each: get("questions"),
        as: "question",
        mode: "every",
        where: {
          op: "eq",
          args: [{ get: get("answers"), key: { get: { variable: "question" }, key: "id" } }, { literal: "accepted" }],
        },
      },
      known: {
        each: { op: "keys", args: [get("answers")] },
        as: "key",
        mode: "every",
        where: {
          each: get("questions"),
          as: "question",
          mode: "some",
          where: { op: "eq", args: [{ variable: "key" }, { get: { variable: "question" }, key: "id" }] },
        },
      },
      missing: { op: "missing", args: [get("absent")] },
      nullIsMissing: { op: "missing", args: [get("nullable")] },
      sameNull: { op: "eq", args: [get("nullable"), { literal: null }] },
      markerIsString: { op: "isString", args: [{ literal: ["\u0001s"] }] },
      numericObjectKey: { op: "eq", args: [{ get: { literal: { "0": "yes" } }, key: 0 }, { literal: "yes" }] },
      keyOrder: {
        op: "eq",
        args: [{ op: "first", args: [{ op: "keys", args: [{ literal: { long: 1, a: 2 } }] }] }, { literal: "a" }],
      },
    };
    const values = [
      {
        blank: "\t\u2003\ufeff",
        text: "a😀",
        choices: ["x", "x"],
        questions: [{ id: "réponse\u0000" }],
        answers: { "réponse\u0000": "accepted" },
        nullable: null,
      },
      {
        blank: "   ",
        text: "ASCII",
        choices: ["a", "b"],
        questions: [{ id: "__proto__" }],
        answers: JSON.parse('{"__proto__":"accepted"}'),
        nullable: null,
      },
      { blank: "\u0000", text: "", choices: [], questions: [], answers: { extra: "accepted" }, nullable: null },
    ];
    const indexes: StorageRecordIndex[] = [{ name: "forms", fields: { body: { path: ["body"], type: "object" } } }];
    for (const records of [
      createDocumentStorageDBService(f.db).open({ owner }).records,
      createMemoryStorage(owner).records,
    ]) {
      await records.commit({
        operationId: "seed",
        edits: values.map((body, i) => ({ recordId: String(i), replace: { body } })),
      });
      await records.defineIndexes(indexes);
      const computed = Object.fromEntries(
        Object.entries(expressions).map(([name, expression]) => [
          name,
          { type: name === "length" ? ("number" as const) : ("boolean" as const), expression },
        ]),
      );
      const page = await records.query({ index: "forms", computed, fields: Object.keys(expressions) });
      expect(page.records.map((record) => record.fields)).toEqual(
        values.map((value) =>
          Object.fromEntries(
            Object.entries(expressions).map(([key, expression]) => [
              key,
              evaluateStorageExpression(expression, () => value) ?? null,
            ]),
          ),
        ),
      );
      const invalid = await records.query({
        index: "forms",
        computed: { wrongType: { type: "boolean", expression: expressions.length } },
        fields: ["wrongType"],
      });
      expect(invalid.records.map((record) => record.fields.wrongType)).toEqual([null, null, null]);
    }
  } finally {
    await f.close();
  }
});

test("expression expansion budgets and reserved computed names agree between engines", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "bounded-expressions" };
    const large: StorageExpression = {
      each: { literal: Array(10001).fill(0) },
      as: "item",
      mode: "every",
      where: { op: "and", args: Array.from({ length: 10 }, () => ({ literal: true })) },
    };
    for (const records of [
      createDocumentStorageDBService(f.db).open({ owner }).records,
      createMemoryStorage(owner).records,
    ]) {
      await records.commit({ operationId: "seed", edits: [{ recordId: "row", replace: { id: "row" } }] });
      await records.defineIndexes([{ name: "rows", fields: { id: { path: ["id"], type: "string" } } }]);
      await expect(
        records.query({ index: "rows", computed: { expanded: { type: "boolean", expression: large } } }),
      ).rejects.toThrow();
      const computed = Object.fromEntries([
        [
          "__proto__",
          {
            type: "boolean" as const,
            expression: { op: "if" as const, args: [{ literal: true }, { literal: true }, large] },
          },
        ],
      ]);
      expect((await records.query({ index: "rows", computed, fields: ["__proto__"] })).records[0].fields).toEqual(
        Object.fromEntries([["__proto__", true]]),
      );
      await expect(
        records.query({
          index: "rows",
          computed: {
            key: {
              type: "string",
              expression: { op: "first", args: [{ op: "keys", args: [{ literal: { été: 1 } }] }] },
            },
          },
        }),
      ).rejects.toThrow("Object keys");
    }
  } finally {
    await f.close();
  }
});

test("Unicode core shorthand joins use the same string identity as collection fields", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "unicode-identities" };
    const service = createDocumentStorageDBService(f.db);
    const records = service.open({ owner }).records;
    await service.open({ owner: { ...owner, extensionId: "pstdio" } }).records.commit({
      operationId: "number",
      edits: [
        {
          recordId: "bé",
          replace: { id: "bé", kind: "thing", prefix: "É", value: 1, extensionId: owner.extensionId, aliases: [] },
        },
      ],
    });
    await records.commit({
      operationId: "seed",
      edits: [
        { recordId: "item", replace: { id: "bé" } },
        { recordId: "link", replace: { ref: "É-1" } },
      ],
    });
    await records.defineIndexes([
      {
        name: "items",
        prefix: "item",
        fields: { id: { path: ["id"], type: "string" }, shorthand: { path: ["unused"], type: "string" } },
        identity: { kind: "thing", idField: "id", shorthandField: "shorthand" },
      },
      { name: "links", prefix: "link", fields: { ref: { path: ["ref"], type: "string" } } },
    ]);
    const page = await records.query({
      index: "items",
      where: { exists: { index: "links", on: [{ sourceField: "shorthand", relatedField: "ref" }] } },
    });
    expect(page.records.map((record) => record.fields.shorthand)).toEqual(["É-1"]);
    expect(
      (await records.query({ index: "items", where: { field: "shorthand", op: "eq", value: "É-1" } })).records,
    ).toHaveLength(1);
  } finally {
    await f.close();
  }
});

test("related field projections filter and aggregate before selecting the page", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "related-fields" };
    for (const records of [
      createDocumentStorageDBService(f.db).open({ owner }).records,
      createMemoryStorage(owner).records,
    ]) {
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "task/1", replace: { id: "1", group: "a" } },
          { recordId: "task/2", replace: { id: "2", group: "b" } },
          { recordId: "group/a", replace: { id: "a", label: "Draft" } },
          { recordId: "group/b", replace: { id: "b", label: "Ready" } },
        ],
      });
      await records.defineIndexes([
        {
          name: "tasks",
          prefix: "task/",
          fields: {
            id: { path: ["id"], type: "string" },
            group: { path: ["group"], type: "string" },
            groupLabel: {
              type: "string",
              lookup: { index: "groups", on: [{ sourceField: "group", relatedField: "id" }], field: "label" },
            },
          },
        },
        {
          name: "groups",
          prefix: "group/",
          fields: { id: { path: ["id"], type: "string" }, label: { path: ["label"], type: "string" } },
          equality: ["id"],
        },
      ] as never);
      const query = { index: "tasks", where: { field: "groupLabel", op: "eq", value: "Ready" } } as const;
      expect((await records.query({ ...query, limit: 1 })).records.map((record) => record.fields)).toEqual([
        { id: "2", group: "b", groupLabel: "Ready" },
      ]);
      expect((await records.aggregate({ ...query, groupBy: "groupLabel" })).groups).toEqual([
        { value: "Ready", count: 1 },
      ]);
    }
  } finally {
    await f.close();
  }
});

test("conditional related projections support global groups and filters before paging", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "conditional-fields" };
    for (const records of [
      createDocumentStorageDBService(f.db).open({ owner }).records,
      createMemoryStorage(owner).records,
    ]) {
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "task/1", replace: { id: "1" } },
          { recordId: "task/2", replace: { id: "2" } },
          { recordId: "review/2", replace: { ticket: "2" } },
        ],
      });
      await records.defineIndexes([
        { name: "tasks", prefix: "task/", fields: { id: { path: ["id"], type: "string" } } },
        {
          name: "reviews",
          prefix: "review/",
          fields: { ticket: { path: ["ticket"], type: "string" } },
          equality: ["ticket"],
        },
      ]);
      const computed = {
        attention: {
          type: "string" as const,
          cases: [
            {
              when: { exists: { index: "reviews", on: [{ sourceField: "id", relatedField: "ticket" }] } },
              value: "yes",
            },
          ],
          otherwise: "no",
        },
      };
      expect(
        (
          await records.query({
            index: "tasks",
            computed,
            where: { field: "attention", op: "eq", value: "yes" },
            limit: 1,
          })
        ).records.map((record) => record.fields),
      ).toEqual([{ id: "2", attention: "yes" }]);
      expect((await records.aggregate({ index: "tasks", computed, groupBy: "attention" })).groups).toEqual([
        { value: "no", count: 1 },
        { value: "yes", count: 1 },
      ]);
    }
  } finally {
    await f.close();
  }
});
