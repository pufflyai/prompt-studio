import { expect, test } from "bun:test";
import { mutationSchema } from "./wire";

const valid = () => ({
  protocolVersion: 1,
  scope: { accountId: "a", workbenchId: "w", extensionId: "x" },
  environmentId: "e",
  operationId: "o",
  fingerprint: "0".repeat(64),
  parents: [],
  changes: [{ recordId: "r", expectedRevision: 0, baseDeleted: false, deleted: true }],
});

test("a group has one change per record and cannot depend on itself", () => {
  const duplicate = valid();
  duplicate.changes.push(duplicate.changes[0]);
  expect(mutationSchema.safeParse(duplicate).success).toBe(false);
  expect(mutationSchema.safeParse({ ...valid(), parents: ["o"] }).success).toBe(false);
});

test("resolution inputs cover the complete captured group", () => {
  const resolution = {
    conflictId: "conflict",
    expectedConflicts: [{ conflictId: "conflict", revision: 1 }],
    capturedOperationIds: ["root"],
    expectedInputs: [{ recordId: "other", revision: 0 }],
  };
  expect(mutationSchema.safeParse({ ...valid(), resolution }).success).toBe(false);
});

test("unknown fields and unsupported versions cannot enter the journal", () => {
  expect(mutationSchema.safeParse({ ...valid(), protocolVersion: 2 }).success).toBe(false);
  expect(mutationSchema.safeParse({ ...valid(), cloudSecret: "no" }).success).toBe(false);
  expect(mutationSchema.safeParse(valid()).success).toBe(true);
});

test("payload fingerprints survive JSON transport and ignore object key order", async () => {
  const { sealMutation, validateMutation } = await import("./fingerprint");
  const group = await sealMutation({
    ...valid(),
    protocolVersion: 1,
    changes: [{ recordId: "r", expectedRevision: 0, baseDeleted: false, deleted: true, shared: undefined }],
  });
  expect(await validateMutation(JSON.parse(JSON.stringify(group)))).toEqual(JSON.parse(JSON.stringify(group)));
  const reordered = { ...group, scope: { extensionId: "x", workbenchId: "w", accountId: "a" } };
  expect((await validateMutation(reordered)).fingerprint).toBe(group.fingerprint);
  await expect(validateMutation({ ...group, environmentId: "changed" })).rejects.toThrow("fingerprint");
});

test("JSON values preserve special property names and reject non-JSON values", async () => {
  const { jsonSchema } = await import("./wire");
  const value = JSON.parse('{"__proto__":{"retained":true},"constructor":"retained"}');
  expect(jsonSchema.parse(value)).toEqual(value);
  expect(Object.hasOwn(jsonSchema.parse(value) as object, "__proto__")).toBe(true);
  expect(jsonSchema.safeParse({ missing: undefined }).success).toBe(false);
  expect(jsonSchema.safeParse({ number: Infinity }).success).toBe(false);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  expect(jsonSchema.safeParse(cyclic).success).toBe(false);
});

test("map keys retain empty JSON property names through wire validation", async () => {
  const { sealMutation, validateMutation } = await import("./fingerprint");
  const mutation = await sealMutation({
    ...valid(),
    protocolVersion: 1,
    changes: [
      {
        recordId: "map",
        expectedRevision: 0,
        baseDeleted: false,
        shared: {
          kind: "map",
          entries: [{ key: "", expected: "0".repeat(64), next: { kind: "set", value: "retained" } }],
        },
      },
    ],
  });
  const received = await validateMutation(JSON.parse(JSON.stringify(mutation)));
  expect(received.changes[0].shared).toEqual(mutation.changes[0].shared);
});
