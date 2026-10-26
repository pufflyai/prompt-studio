import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { shortcutActionLabel } from "./shortcut-label";

test("viewer shortcuts use the destination resource label or identity", () => {
  const core = createWorkbench();
  const resource = { type: "session", id: "session-1", label: "Review keyboard navigation" };
  expect(shortcutActionLabel(core, { kind: "viewer", operation: "switch", resource })).toBe(resource.label);
  expect(
    shortcutActionLabel(core, { kind: "viewer", operation: "replace", resource: { ...resource, label: undefined } }),
  ).toBe(resource.id);
});
