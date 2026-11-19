import { expect, test } from "bun:test";
import { matchesExtensionProvenance } from "./extension-provenance-filter";

test("public and locally maintained filters overlap without classifying unknown sources", () => {
  const localPublic = { ownership: "mine", visibility: "public" } as const;
  expect(matchesExtensionProvenance(localPublic, "public")).toBe(true);
  expect(matchesExtensionProvenance(localPublic, "mine")).toBe(true);
  expect(matchesExtensionProvenance({ visibility: "public" }, "mine")).toBe(false);
  expect(matchesExtensionProvenance({ ownership: "mine" }, "public")).toBe(false);
  expect(matchesExtensionProvenance({}, "all")).toBe(true);
  expect(matchesExtensionProvenance({}, "public")).toBe(false);
  expect(matchesExtensionProvenance({}, "mine")).toBe(false);
});
