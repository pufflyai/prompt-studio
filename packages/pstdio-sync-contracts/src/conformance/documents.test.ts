import { expect, test } from "bun:test";
import type { SharedEdit } from "../authoring";
import { sealMutation } from "../fingerprint";
import { applyChange, blank, cellFingerprint, sharedChange } from "./documents";

const cases: { name: string; edits: SharedEdit[]; expected: Record<string, string> }[] = [
  {
    name: "setting a map key twice",
    edits: [
      { kind: "map.set", key: "key", value: "first" },
      { kind: "map.set", key: "key", value: "last" },
    ],
    expected: { key: "last" },
  },
  {
    name: "setting then deleting a map key",
    edits: [
      { kind: "map.set", key: "key", value: "temporary" },
      { kind: "map.delete", key: "key" },
    ],
    expected: {},
  },
  {
    name: "deleting then setting a map key",
    edits: [
      { kind: "map.delete", key: "key" },
      { kind: "map.set", key: "key", value: "last" },
    ],
    expected: { key: "last" },
  },
];
for (const scenario of cases) {
  test(`${scenario.name} saves the final value against the original cell`, async () => {
    const record = { ...blank("map"), map: { key: "original" } };
    const shared = await sharedChange(record, scenario.edits);
    const mutation = await sealMutation({
      protocolVersion: 2,
      epoch: "initial",
      generation: 0,
      sequence: 1,
      scope: { accountId: "a", workbenchId: "w", extensionId: "x" },
      environmentId: "e",
      operationId: "o",
      parents: [],
      changes: [{ recordId: record.recordId, expectedRevision: 0, baseDeleted: false, shared }],
    });
    expect(shared.kind).toBe("map");
    if (shared.kind !== "map") throw new Error("Expected map changes");
    expect(shared.entries).toHaveLength(1);
    expect(shared.entries[0].expected).toBe(await cellFingerprint(record.map, "key"));
    expect(applyChange(record, mutation.changes[0]).map).toEqual(scenario.expected);
  });
}
