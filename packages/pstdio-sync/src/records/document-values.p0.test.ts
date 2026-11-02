import { expect, test } from "bun:test";
import * as Y from "yjs";
import { readValue } from "./document-values";

test("merged list order keeps the last visible occurrence of each surviving item", () => {
  const document = new Y.Doc();
  const items = document.getMap("list:items");
  items.set("one", "One");
  items.set("two", "Two");
  items.set("three", "Three");
  document.getArray("list:order").insert(0, ["one", "two", "one", "deleted", "three", "two"]);
  expect(readValue({ kind: "list", name: "list" }, document)).toEqual(["One", "Three", "Two"]);
  document.destroy();
});
