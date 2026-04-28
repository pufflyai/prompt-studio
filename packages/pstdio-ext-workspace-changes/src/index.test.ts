import { describe, expect, test } from "bun:test";
import extension, { WORKSPACE_CHANGES_EXTENSION_ID, WORKSPACE_SHELL_TABS_SLOT } from "./index";

describe("workspace changes extension", () => {
  test("contributes the changes tab to the workspace shell slot", () => {
    expect(extension.id).toBe(WORKSPACE_CHANGES_EXTENSION_ID);
    expect(extension.views?.changes).toEqual(
      expect.objectContaining({
        type: "workspace.tab",
        label: "Changes",
        target: "workspace",
        slot: WORKSPACE_SHELL_TABS_SLOT,
      }),
    );
    expect(typeof extension.views?.changes.component).toBe("function");
  });
});
