import { expect, test } from "bun:test";
import * as Y from "yjs";
import { writeText } from "./document-values";
import { missingUpdate } from "./relay/document-merge";
import { mergeTextDocuments, seedTextDocument } from "./text-document-adoption";
import { editTextDocument } from "./text-document-edits";

const seeded = async (source: string) => {
  const document = new Y.Doc();
  await seedTextDocument(document, source);
  return document;
};
const edit = (document: Y.Doc, source: string) => editTextDocument(document, (text) => writeText(text, source));
const text = (document: Y.Doc) => document.getText("content").toString();
const clone = (document: Y.Doc) => {
  const result = new Y.Doc();
  Y.applyUpdate(result, Y.encodeStateAsUpdate(document));
  return result;
};

test("a never-opened local document adopts the downloaded source", async () => {
  const local = new Y.Doc();
  const remote = await seeded("downloaded text");
  const merged = await mergeTextDocuments(local, remote);
  expect(text(merged)).toBe("downloaded text");
  for (const document of [local, remote, merged]) document.destroy();
});

test("unresolved local character operations are preserved instead of being treated as an empty document", async () => {
  const original = await seeded("original");
  const before = Y.encodeStateVector(original);
  original.getText("content").insert(0, "pending ");
  const pending = new Y.Doc();
  Y.applyUpdate(pending, Y.encodeStateAsUpdate(original, before));
  expect(Y.decodeStateVector(Y.encodeStateVector(pending)).size).toBe(0);
  const saved = Y.encodeStateAsUpdate(pending);
  const remote = await seeded("canonical");
  await expect(mergeTextDocuments(pending, remote)).rejects.toThrow("initial history");
  await expect(seedTextDocument(pending, "loaded source")).rejects.toThrow("unseeded");
  expect(Y.encodeStateAsUpdate(pending)).toEqual(saved);
  for (const document of [original, pending, remote]) document.destroy();
});

test("a text document is seeded once, including an intentionally empty file", async () => {
  for (const source of ["", "first\nlast"]) {
    const document = await seeded(source);
    expect(await seedTextDocument(document, "stale load")).toBe(false);
    expect(text(document)).toBe(source);
    document.destroy();
  }
});

test("independently opened copies adopt one initial history and retain both devices' edits", async () => {
  const local = await seeded("first\nmiddle\nlast");
  const remote = await seeded("first\nmiddle\nlast");
  edit(local, "FIRST\nmiddle\nlast");
  edit(remote, "first\nmiddle\nLAST");
  const merged = await mergeTextDocuments(local, remote);
  expect(text(merged)).toBe("FIRST\nmiddle\nLAST");
  const repeated = await mergeTextDocuments(merged, remote);
  expect(text(repeated)).toBe(text(merged));
  for (const document of [local, remote, merged, repeated]) document.destroy();
});

test("adopting a deletion keeps characters another device inserted between the deleted originals", async () => {
  const local = await seeded("abc");
  const remote = await seeded("abc");
  edit(local, "a");
  edit(remote, "abXc");
  const merged = await mergeTextDocuments(local, remote);
  expect(text(merged)).toBe("aX");
  for (const document of [local, remote, merged]) document.destroy();
});

test("devices with a shared seed merge their original character operations", async () => {
  const remote = await seeded("start\nend");
  const local = clone(remote);
  edit(local, "START\nend");
  edit(remote, "start\nEND");
  const merged = await mergeTextDocuments(local, remote);
  expect(text(merged)).toBe("START\nEND");
  for (const document of [local, remote, merged]) document.destroy();
});

test("an untouched differing initial copy adopts the canonical source without adding its old content", async () => {
  const local = await seeded("older source");
  const remote = await seeded("canonical source");
  const merged = await mergeTextDocuments(local, remote);
  expect(text(merged)).toBe("canonical source");
  for (const document of [local, remote, merged]) document.destroy();
});

test("an edit with no matching original characters retains the canonical text and the inserted edit", async () => {
  const local = await seeded("abc");
  const remote = await seeded("xyz");
  edit(local, "aBC");
  const merged = await mergeTextDocuments(local, remote);
  expect(text(merged)).toBe("xyzBC");
  for (const document of [local, remote, merged]) document.destroy();
});

test("adoption does not delete a neighbouring character when the original was already deleted", async () => {
  const local = await seeded("a😀bc");
  const remote = await seeded("a😀bc");
  edit(local, "abc");
  edit(remote, "aXbc");
  const merged = await mergeTextDocuments(local, remote);
  expect(text(merged)).toBe("aXbc");
  for (const document of [local, remote, merged]) document.destroy();
});

test("two hosts carrying the same old-history edit translate that edit only once", async () => {
  const canonical = await seeded("abc");
  const first = await seeded("abc");
  first.getText("content").insert(0, "X");
  const second = clone(first);
  const once = await mergeTextDocuments(first, canonical);
  const twice = await mergeTextDocuments(second, once);
  expect(text(twice)).toBe("Xabc");
  expect(missingUpdate(twice, once)).toBeNull();
  for (const document of [canonical, first, second, once, twice]) document.destroy();
});

test("retired-history deletions keep a repeated character inserted by a canonical editor", async () => {
  const canonical = await seeded("a");
  canonical.getText("content").insert(0, "a");
  const old = await seeded("a");
  const joined = await mergeTextDocuments(old, canonical);
  expect(text(joined)).toBe("aa");
  editTextDocument(old, (text) => text.delete(0, 1));
  const next = await mergeTextDocuments(old, joined);
  const original = (await import("./text-document-seed")).readTextDocumentSeed;
  const genesis = new Y.Doc();
  Y.applyUpdate(genesis, (await original(canonical)).state);
  const originalCharacter = Y.createRelativePositionFromTypeIndex(genesis.getText("content"), 0);
  const remaining = Y.createRelativePositionFromTypeIndex(next.getText("content"), 0);
  expect(text(next)).toBe("a");
  expect(remaining.item).not.toEqual(originalCharacter.item);
  for (const document of [canonical, old, joined, next, genesis]) document.destroy();
});

test("returning to an earlier canonical history preserves shared edits without translating them twice", async () => {
  const first = await seeded("abc");
  first.getText("content").insert(0, "X");
  const second = await seeded("abc");
  second.getText("content").insert(3, "Y");
  const joined = await mergeTextDocuments(first, second);
  const restored = await mergeTextDocuments(joined, first);
  expect(text(restored)).toBe("XabcY");
  for (const document of [first, second, joined, restored]) document.destroy();
});

test("a deletion stays deleted when its translated history passes through another root", async () => {
  const first = await seeded("abc");
  first.getText("content").insert(0, "X");
  const second = await seeded("abc");
  const joined = await mergeTextDocuments(first, second);
  editTextDocument(joined, (text) => text.delete(0, 1));
  const third = await seeded("abc");
  const next = await mergeTextDocuments(joined, third);
  expect(text(next)).toBe("abc");
  for (const document of [first, second, joined, third, next]) document.destroy();
});

test("aligning untouched initial sources through different roots never deletes canonical text", async () => {
  const canonical = await seeded("aba");
  const first = await seeded("a");
  const second = await seeded("ba");
  const direct = await mergeTextDocuments(first, canonical);
  const indirect = await mergeTextDocuments(first, second);
  const next = await mergeTextDocuments(indirect, direct);
  expect(text(next)).toBe("aba");
  for (const document of [canonical, first, second, direct, indirect, next]) document.destroy();
});

test("shared-root recovery reconciles independently translated copies of one retired edit", async () => {
  const canonical = await seeded("abc");
  const staleCanonical = clone(canonical);
  const old = await seeded("abc");
  old.getText("content").insert(0, "X");
  const beforeLoss = await mergeTextDocuments(old, canonical);
  const afterLoss = await mergeTextDocuments(old, staleCanonical);
  const restored = await mergeTextDocuments(beforeLoss, afterLoss);
  expect(text(restored)).toBe("Xabc");
  for (const document of [canonical, staleCanonical, old, beforeLoss, afterLoss, restored]) document.destroy();
});

test("a later delete follows the surviving identity after transitive duplicate repair", async () => {
  const original = await seeded("abc");
  original.getText("content").insert(0, "X");
  const first = await seeded("abc");
  const second = await seeded("abc");
  const firstJoined = await mergeTextDocuments(original, first);
  const secondJoined = await mergeTextDocuments(original, second);
  const unified = await mergeTextDocuments(firstJoined, secondJoined);
  expect(text(unified)).toBe("Xabc");
  editTextDocument(firstJoined, (text) => text.delete(0, 1));
  const deleted = await mergeTextDocuments(firstJoined, unified);
  expect(text(deleted)).toBe("abc");
  for (const document of [original, first, second, firstJoined, secondJoined, unified, deleted]) document.destroy();
});

for (const canonical of ["", "a", "b", "aa", "ab", "ba", "aba", "a\r\nb"]) {
  test(`untouched canonical source ${JSON.stringify(canonical)} survives different adoption paths`, async () => {
    for (const firstSource of ["", "a", "b", "aa", "ab", "ba", "aba"]) {
      for (const secondSource of ["", "a", "b", "aa", "ab", "ba", "aba"]) {
        const target = await seeded(canonical);
        const first = await seeded(firstSource);
        const second = await seeded(secondSource);
        const direct = await mergeTextDocuments(first, target);
        const indirect = await mergeTextDocuments(first, second);
        const next = await mergeTextDocuments(indirect, direct);
        try {
          expect(text(next)).toBe(canonical);
        } finally {
          for (const document of [target, first, second, direct, indirect, next]) document.destroy();
        }
      }
    }
  });
}

test("one original deletion follows the established mapping through a different initial source", async () => {
  const canonical = await seeded("aba");
  const first = await seeded("a");
  const second = await seeded("ba");
  const direct = await mergeTextDocuments(first, canonical);
  editTextDocument(first, (text) => text.delete(0, 1));
  const directDelete = await mergeTextDocuments(first, direct);
  expect(text(directDelete)).toBe("ba");
  const indirect = await mergeTextDocuments(first, second);
  const next = await mergeTextDocuments(indirect, direct);
  expect(text(next)).toBe("ba");
  for (const document of [canonical, first, second, direct, directDelete, indirect, next]) document.destroy();
});

test("independent original deletions survive alongside a translated deletion", async () => {
  const canonical = await seeded("aba");
  const first = await seeded("a");
  const second = await seeded("ba");
  const direct = await mergeTextDocuments(first, canonical);
  editTextDocument(first, (text) => text.delete(0, 1));
  editTextDocument(second, (text) => text.delete(1, 1));
  const indirect = await mergeTextDocuments(first, second);
  const next = await mergeTextDocuments(indirect, direct);
  expect(text(next)).toBe("b");
  for (const document of [canonical, first, second, direct, indirect, next]) document.destroy();
});

test("a four-root insertion graph never turns duplicate repair into a user deletion", async () => {
  const original = await seeded("abc");
  original.getText("content").insert(0, "X");
  const first = await seeded("abc");
  const second = await seeded("abc");
  const third = await seeded("abc");
  const firstJoined = await mergeTextDocuments(original, first);
  const secondJoined = await mergeTextDocuments(original, second);
  const direct = await mergeTextDocuments(firstJoined, third);
  const indirect = await mergeTextDocuments(firstJoined, secondJoined);
  const next = await mergeTextDocuments(indirect, direct);
  expect(text(next)).toBe("Xabc");
  for (const document of [original, first, second, third, firstJoined, secondJoined, direct, indirect, next])
    document.destroy();
});

test("an authored deletion reaches another existing copy through a translated ancestor", async () => {
  const original = await seeded("abc");
  original.getText("content").insert(0, "X");
  const first = await seeded("abc");
  const second = await seeded("abc");
  const third = await seeded("abc");
  const firstJoined = await mergeTextDocuments(original, first);
  const secondJoined = await mergeTextDocuments(original, second);
  const thirdJoined = await mergeTextDocuments(original, third);
  editTextDocument(firstJoined, (text) => text.delete(0, 1));
  const deleted = await mergeTextDocuments(firstJoined, secondJoined);
  expect(text(deleted)).toBe("abc");
  const next = await mergeTextDocuments(deleted, thirdJoined);
  expect(text(next)).toBe("abc");
  for (const document of [original, first, second, third, firstJoined, secondJoined, thirdJoined, deleted, next])
    document.destroy();
});

test("return cycles preserve one insertion across independently restored roots", async () => {
  const original = await seeded("abc");
  original.getText("content").insert(0, "X");
  const first = await seeded("abc");
  const second = await seeded("abc");
  const firstOnOriginal = await mergeTextDocuments(first, original);
  const secondOnOriginal = await mergeTextDocuments(second, firstOnOriginal);
  const backSecond = await mergeTextDocuments(secondOnOriginal, second);
  const directSecond = await mergeTextDocuments(firstOnOriginal, second);
  const backFirst = await mergeTextDocuments(firstOnOriginal, first);
  const left = await mergeTextDocuments(directSecond, backFirst);
  const right = await mergeTextDocuments(backFirst, backSecond);
  expect(text(left)).toBe("Xabc");
  expect(text(right)).toBe("Xabc");
  const next = await mergeTextDocuments(left, right);
  expect(text(next)).toBe("Xabc");
  for (const document of [
    original,
    first,
    second,
    firstOnOriginal,
    secondOnOriginal,
    backSecond,
    directSecond,
    backFirst,
    left,
    right,
    next,
  ])
    document.destroy();
});

test("repeated reconnect cycles retain one authored insertion and accept a late source deletion", async () => {
  const roots = await Promise.all(Array.from({ length: 4 }, () => seeded("abc")));
  editTextDocument(roots[0]!, (text) => text.insert(1, "XY"));
  const late = clone(roots[0]!);
  const owned = new Set([...roots, late]);
  const copies = [...roots];
  try {
    for (let round = 0; round < 6; round++)
      for (let index = 0; index < copies.length; index++) {
        const merged = await mergeTextDocuments(copies[index]!, copies[(index + 1) % copies.length]!);
        owned.add(merged);
        copies[index] = merged;
        expect(["abc", "aXYbc"]).toContain(text(merged));
        if (round >= copies.length - 1) expect(text(merged)).toBe("aXYbc");
      }
    editTextDocument(late, (text) => text.delete(1, 1));
    const deleted = await mergeTextDocuments(late, copies[2]!);
    owned.add(deleted);
    expect(text(deleted)).toBe("aYbc");
    for (const copy of copies) {
      const merged = await mergeTextDocuments(copy, deleted);
      owned.add(merged);
      expect(text(merged)).toBe("aYbc");
    }
  } finally {
    for (const document of owned) document.destroy();
  }
});

test("identically spelled independent insertions remain separate edits after a return cycle", async () => {
  const first = await seeded("abc");
  const second = await seeded("abc");
  editTextDocument(first, (text) => text.insert(1, "X"));
  editTextDocument(second, (text) => text.insert(1, "X"));
  const joined = await mergeTextDocuments(first, second);
  const returned = await mergeTextDocuments(joined, first);
  const repeated = await mergeTextDocuments(second, returned);
  expect(text(joined)).toBe("aXXbc");
  expect(text(returned)).toBe("aXXbc");
  expect(text(repeated)).toBe("aXXbc");
  for (const document of [first, second, joined, returned, repeated]) document.destroy();
});

test("surrogate pairs survive duplicate normalization and a later complete deletion", async () => {
  for (const insertion of ["😀", "👩‍💻"]) {
    const original = await seeded("base");
    editTextDocument(original, (text) => text.insert(0, insertion));
    const first = await seeded("base");
    const second = await seeded("base");
    const direct = await mergeTextDocuments(original, first);
    const indirect = await mergeTextDocuments(original, second);
    const joined = await mergeTextDocuments(direct, indirect);
    const returned = await mergeTextDocuments(joined, original);
    expect(text(joined)).toBe(`${insertion}base`);
    expect(text(returned)).toBe(`${insertion}base`);
    editTextDocument(original, (text) => text.delete(0, insertion.length));
    const deleted = await mergeTextDocuments(original, returned);
    expect(text(deleted)).toBe("base");
    for (const document of [original, first, second, direct, indirect, joined, returned, deleted]) document.destroy();
  }
});
