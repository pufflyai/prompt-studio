import { expect, test } from "bun:test";
import { resolveExtensionChoices } from "./catalog";
import { previewExtensions } from "./preview-inventory";

test("uses current default-extension names and icons from the catalog with installed-icon precedence", () => {
  const inventory = {
    extensions: [{ extensionId: "pstdio.pstdio-notes", icon: "installed-notes" }],
    marketplace: previewExtensions,
  };
  const choices = resolveExtensionChoices(inventory);
  for (const name of [
    "pstdio-base-themes",
    "pstdio-skills",
    "pstdio-planner",
    "pstdio-reports",
    "pstdio-artifacts",
    "pstdio-skill-browser",
  ]) {
    const entry = previewExtensions.find((e) => e.installName === name)!;
    expect(choices[name]).toEqual({ name: entry.displayName, icon: entry.icon });
  }
  expect(choices["pstdio-notes"].icon).toBe("installed-notes");
});
