import { expect, test } from "bun:test";
import { SelectionMenu } from "./selection-menu";

test("pending custom selection cannot change saved or newly entered values and becomes editable when ready", () => {
  const changes: string[] = [];
  const picker = (disabled: boolean) =>
    SelectionMenu({
      triggerLabel: "Saved custom value",
      options: [{ id: "saved", name: "Saved custom value" }],
      selectedIds: ["saved"],
      multiSelect: true,
      allowCustomValues: true,
      disabled,
      onToggle: (id) => changes.push(id),
    });
  const pending = picker(true).props;
  pending.items[0].onSelect();
  const pendingNew = pending.filterItems(pending.items, "new value").at(-1);
  pendingNew.onSelect();
  expect(pending.items[0].isDisabled).toBe(true);
  expect(pendingNew.isDisabled).toBe(true);
  expect(changes).toEqual([]);
  const ready = picker(false).props;
  ready.items[0].onSelect();
  ready.filterItems(ready.items, "new value").at(-1).onSelect();
  expect(changes).toEqual(["saved", "new value"]);
});
