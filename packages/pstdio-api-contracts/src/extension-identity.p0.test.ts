import { expect, test } from "bun:test";
import {
  canonicalExtensionId,
  canonicalInstallName,
  extensionIdentityRenames,
  historicalCliPaths,
  historicalExtensionId,
  validateExtensionIdentityRenames,
} from "./extension-identity";

test("historical first-party owners have one canonical identity and one retained transport identity", () => {
  validateExtensionIdentityRenames(extensionIdentityRenames);
  expect(extensionIdentityRenames).toHaveLength(13);
  for (const { from, to } of extensionIdentityRenames) {
    const oldId = `${from.publisher}.${from.name}`;
    const id = `${to.publisher}.${to.name}`;
    expect(canonicalExtensionId(oldId)).toBe(id);
    expect(canonicalExtensionId(id)).toBe(id);
    expect(historicalExtensionId(oldId)).toBe(oldId);
    expect(historicalExtensionId(id)).toBe(oldId);
    expect(canonicalInstallName(oldId)).toBe(to.name);
    expect(canonicalInstallName(from.name)).toBe(to.name);
  }
  for (const id of ["alice.pstdio-notes", "pstdio.canvas", "pstdio.font-editor", "pstdio.notes-extra"]) {
    expect(canonicalExtensionId(id)).toBe(id);
    expect(historicalExtensionId(id)).toBe(id);
  }
});

test("Notes retains qualified, historical short and previous nested command paths", () => {
  expect(historicalCliPaths("pstdio.notes", "notes.create", ["create"])).toEqual([
    ["pstdio.pstdio-notes", "notes", "create"],
    ["pstdio-notes", "notes", "create"],
    ["pstdio.notes", "notes", "create"],
  ]);
  expect(historicalCliPaths("alice.notes", "notes.create", ["create"])).toEqual([]);
});

test("invalid rename inventories cannot claim another publisher or fork ownership", () => {
  const rename = extensionIdentityRenames[0]!;
  expect(() => validateExtensionIdentityRenames([rename, rename])).toThrow();
  expect(() =>
    validateExtensionIdentityRenames([{ from: rename.from, to: { ...rename.to, publisher: "alice" } }]),
  ).toThrow();
  expect(() => validateExtensionIdentityRenames([{ from: rename.from, to: rename.from }])).toThrow();
  expect(() => validateExtensionIdentityRenames([rename, { from: rename.to, to: rename.from }])).toThrow();
});
