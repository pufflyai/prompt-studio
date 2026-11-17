import { expect, test } from "bun:test";
import { createTreeBackgroundActions } from "./tree-background-actions";

test("background creation waits for menu focus release while clipboard actions keep the selection gesture", () => {
  const called: string[] = [];
  const actions = createTreeBackgroundActions(
    [
      {
        id: "files",
        nodes: [],
        contextMenuItems: [
          { id: "create", label: "New file", onAction: () => called.push("create") },
          { id: "copy", label: "Copy path", runOnSelect: true, onAction: () => called.push("copy") },
        ],
      },
    ],
    [],
  );
  actions[0]?.onSelect?.();
  expect(called).toEqual([]);
  actions[1]?.onSelect?.();
  expect(called).toEqual(["copy"]);
  actions[0]?.onClick?.();
  expect(called).toEqual(["copy", "create"]);
  expect(actions.every((action) => action.closeOnSelect)).toBe(true);
});
