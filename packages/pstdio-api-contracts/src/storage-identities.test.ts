import { expect, test } from "bun:test";
import { createStorageMigration } from "./storage-identities";

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
