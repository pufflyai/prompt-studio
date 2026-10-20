import { expect, test } from "bun:test";
import { createStorageId, createStorageMigration, formatStorageId } from "./storage-identities";

test("compact encoding retains all 128 bits and leading zeros in byte order", () => {
  const vectors = [
    ["00000000000000000000000000000000", "0000000000000000000000"],
    ["00000000000000000000000000000001", "0000000000000000000001"],
    ["80000000000000000000000000000000", "3tX16dB2jpss4tZORYcqo4"],
    ["ffffffffffffffffffffffffffffffff", "7n42DGM5Tflk9n8mt7Fhc7"],
  ];
  const encoded = vectors.map(([hex, body]) => {
    const bytes = Uint8Array.fromHex(hex!);
    const id = formatStorageId(bytes, "tk");
    expect(id).toBe(`tk_${body}`);
    expect(decodeCompactId(id)).toBe(hex!);
    return id;
  });
  expect([...encoded].sort()).toEqual(encoded);
});

const decodeCompactId = (id: string) => {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const body = id.slice(id.indexOf("_") + 1);
  let value = 0n;
  for (const character of body) value = value * 62n + BigInt(alphabet.indexOf(character));
  return value.toString(16).padStart(32, "0");
};

test("prefixed IDs retain UUIDv7 layout, fixed width and timestamp order", async () => {
  const before = Date.now();
  const first = createStorageId("tk");
  expect(first).toMatch(/^tk_[0-9A-Za-z]{22}$/);
  const hex = decodeCompactId(first);
  expect(hex[12]).toBe("7");
  expect("89ab").toContain(hex[16]!);
  expect(Number.parseInt(hex.slice(0, 12), 16)).toBeGreaterThanOrEqual(before);
  expect(Number.parseInt(hex.slice(0, 12), 16)).toBeLessThanOrEqual(Date.now());
  await Bun.sleep(2);
  expect(createStorageId("tk") > first).toBe(true);
  const ids = Array.from({ length: 1_000 }, () => createStorageId("tk"));
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every((id) => /^tk_[0-9A-Za-z]{22}$/.test(id))).toBe(true);
  expect(createStorageId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("compact migration IDs preserve every UUID bit and the stable namespace", () => {
  const namespace = ["example.notes", "workbench", "project", "scope", 1];
  const first = createStorageMigration(namespace);
  const second = createStorageMigration([...namespace]);
  for (const key of ["source", "operation:source", "leading-zero", "high-bit"]) {
    const compact = first.id(key, "nt");
    expect(compact).toMatch(/^nt_[0-9A-Za-z]{22}$/);
    expect(decodeCompactId(compact)).toBe(first.id(key).replaceAll("-", ""));
    expect(second.id(key, "nt")).toBe(compact);
    expect(first.id(key, "op").slice(3)).toBe(compact.slice(3));
  }
  expect(createStorageMigration([...namespace, "other"]).id("source", "nt")).not.toBe(first.id("source", "nt"));
});

test("ID prefixes are short lowercase labels and invalid labels fail", () => {
  for (const prefix of ["", "TK", "tk_", "0tk", "a".repeat(17), "../tk", "é"]) {
    expect(() => createStorageId(prefix)).toThrow("ID prefix");
    expect(() => createStorageMigration(["owner", 1]).id("source", prefix)).toThrow("ID prefix");
  }
  expect(createStorageId("a0")).toMatch(/^a0_[0-9A-Za-z]{22}$/);
});

test("migration IDs separate every part of their namespace and preserve source key boundaries", () => {
  const namespace = ["example.notes", "workbench", "resource", "note", 1];
  const id = createStorageMigration(namespace).id("source");
  expect(createStorageMigration([...namespace]).id("source")).toBe(id);
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  for (let index = 0; index < namespace.length; index++) {
    const different = [...namespace];
    different[index] = `${namespace[index]}-other`;
    expect(createStorageMigration(different).id("source")).not.toBe(id);
  }
  expect(createStorageMigration(namespace).id("other-source")).not.toBe(id);
  expect(createStorageMigration(["a", "b:c"]).id("d")).not.toBe(createStorageMigration(["a:b", "c"]).id("d"));
});
