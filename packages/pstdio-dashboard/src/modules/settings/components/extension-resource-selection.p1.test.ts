import { expect, test } from "bun:test";
import { findExtensionByResource } from "./extension-resource-selection";

test("extension progress links open the same detail by canonical identity or installed name", () => {
  const source = { extensionId: "alice.notes", installName: "team-notes" };
  const extensions = [{ extensionId: "bob.notes", installName: "notes" }, source];
  expect(findExtensionByResource(extensions, "alice.notes")).toBe(source);
  expect(findExtensionByResource(extensions, "team-notes")).toBe(source);
  expect(findExtensionByResource(extensions, "unknown.notes")).toBeUndefined();
  const aliased = { extensionId: "charlie.notes", installName: "alice.notes" };
  expect(findExtensionByResource([source, aliased], "alice.notes")).toBe(aliased);
});
