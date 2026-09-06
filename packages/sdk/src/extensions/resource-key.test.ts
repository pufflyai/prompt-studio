import { expect, test } from "bun:test";
import { resourceKey } from "./resource-key";

test("resource identity includes the kind and owner and ignores presentation", () => {
  const note = { type: "note", id: "one", extensionId: "acme.notes" };
  expect(resourceKey(note)).toBe(resourceKey({ ...note, label: "Renamed" }));
  expect(resourceKey(note)).not.toBe(resourceKey({ ...note, type: "task" }));
  expect(resourceKey(note)).not.toBe(resourceKey({ ...note, extensionId: "other.notes" }));
});
