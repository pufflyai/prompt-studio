import { expect, test } from "bun:test";
import { resolveExtensionChoices } from "./catalog";
import { previewExtensions } from "./preview-inventory";

test("uses current default-extension names and icons from the catalog with installed-icon precedence", () => {
  const inventory = {
    extensions: [{ extensionId: "pstdio.notes", icon: "installed-notes" }],
    marketplace: previewExtensions,
  };
  const choices = resolveExtensionChoices(inventory);
  for (const name of ["base-themes", "skills", "planner", "reports", "artifacts"]) {
    const entry = previewExtensions.find((e) => e.installName === name)!;
    expect(choices[name]).toEqual({ name: entry.displayName, icon: entry.icon });
  }
  expect(choices["notes"].icon).toBe("installed-notes");
});
