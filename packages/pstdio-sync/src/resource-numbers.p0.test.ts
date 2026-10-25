import { expect, test } from "bun:test";
import * as Y from "yjs";
import {
  reconcileResourceNumbers,
  rememberResourceNumber,
  resourceIdentity,
  resourceNumbers,
} from "./resource-numbers";

const allocate = (document: Y.Doc, id: string, value: number, kind = "ticket", prefix = "PS") => {
  const resource = { id, kind, prefix, extensionId: "example.planner", value };
  resourceNumbers(document).set(id, resource);
  rememberResourceNumber(document, resource);
};
const merge = (target: Y.Doc, update: Uint8Array) => {
  Y.applyUpdate(target, update);
  reconcileResourceNumbers(target);
};
const identities = (document: Y.Doc) =>
  [...resourceNumbers(document).values()]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((resource) => resourceIdentity(document, resource));

test("three offline repairs converge and preserve aliases from earlier repairs", () => {
  const documents = [new Y.Doc(), new Y.Doc(), new Y.Doc()];
  try {
    allocate(documents[0]!, "c", 31);
    allocate(documents[1]!, "b", 31);
    allocate(documents[2]!, "a", 31);
    const offline = documents.map((document) => Y.encodeStateAsUpdate(document));
    merge(documents[0]!, offline[1]!);
    merge(documents[1]!, offline[2]!);
    merge(documents[2]!, offline[0]!);
    // Each replica repaired a different pair before learning about the third device.
    for (let round = 0; round < 3; round++) {
      const updates = documents.map((document) => Y.encodeStateAsUpdate(document));
      for (const document of documents) for (const update of updates) merge(document, update);
    }
    const expected = identities(documents[0]!);
    for (const document of documents) {
      expect(identities(document)).toEqual(expected);
      expect(new Set(identities(document).map((resource) => resource.shorthand)).size).toBe(3);
    }
    expect(expected[0]?.shorthand).toBe("PS-31");
    expect(expected[1]?.aliases).toContain("PS-31");
    expect(expected[2]?.aliases).toContain("PS-32");
    for (const document of documents) expect(reconcileResourceNumbers(document)).toEqual([]);
  } finally {
    for (const document of documents) document.destroy();
  }
});

test("repair leaves another kind alone and skips every allocated number", () => {
  const document = new Y.Doc();
  try {
    allocate(document, "a", 31);
    allocate(document, "b", 31);
    allocate(document, "c", 32);
    allocate(document, "report", 31, "report", "RP");
    reconcileResourceNumbers(document);
    expect(identities(document).map((resource) => resource.shorthand)).toEqual(["PS-31", "PS-33", "PS-32", "RP-31"]);
  } finally {
    document.destroy();
  }
});
