import { expect, test } from "bun:test";
import { toActionBarSnapshot } from "./action-bar-snapshot";

test("action bars resolve bound commands and live state for buttons and menus", () => {
  const target = {
    kind: "command",
    target: { command: { kind: "command", id: "edit" }, params: { action: { type: "tool", tool: "move" } } },
  };
  const snapshot = toActionBarSnapshot(
    {
      items: [
        { id: "move", label: "Move", selected: true, action: target },
        {
          id: "document",
          label: "Document",
          includeResourceActions: true,
          items: [
            {
              id: "undo",
              label: "Undo",
              disabled: true,
              action: { ...target, target: { ...target.target, params: { action: { type: "undo" } } } },
            },
          ],
        },
      ],
    },
    "example.editor",
    "project",
  );
  expect(snapshot.items[0]).toEqual({
    id: "move",
    label: "Move",
    selected: true,
    action: {
      kind: "command",
      commandId: "example.editor.command.edit",
      args: { action: { type: "tool", tool: "move" } },
    },
  });
  expect(snapshot.items[1]).toMatchObject({
    id: "document",
    includeResourceActions: true,
    items: [
      { disabled: true, action: { commandId: "example.editor.command.edit", args: { action: { type: "undo" } } } },
    ],
  });
});

test("action bars reject invalid command targets before rendering", () => {
  expect(() =>
    toActionBarSnapshot(
      {
        items: [{ id: "bad", label: "Bad action", action: { kind: "command", target: { command: "edit" } } }],
      },
      "example.editor",
      "project",
    ),
  ).toThrow();
});
