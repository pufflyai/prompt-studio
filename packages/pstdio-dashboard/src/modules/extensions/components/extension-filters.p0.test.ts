import { expect, test } from "bun:test";
import { matchesExtensionSearch } from "./extension-filters";

test("finds marketplace entries by their install name as well as their display identity", () => {
  const extension = {
    installName: "special-tool",
    displayName: "Useful workflows",
    extensionId: "acme.workflows",
    description: "Workflow actions",
  };
  expect(matchesExtensionSearch(extension, " SPECIAL-tool ")).toBe(true);
  expect(matchesExtensionSearch(extension, "acme.workflows")).toBe(true);
});
