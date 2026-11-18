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

test("a grouped selection shows an extension's image icon for its rows and the selected group", () => {
  const svg = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg"/>')}`;
  const menu = SelectionMenu({
    triggerLabel: "Model",
    options: [{ id: "model", name: "Model" }],
    selectedIds: ["model"],
    multiSelect: false,
    group: {
      id: "harnessId",
      name: "Harness",
      defaultValue: "custom",
      options: [
        { id: "custom", name: "Custom", icon: svg },
        { id: "named", name: "Named", icon: "Terminal" },
      ],
    },
    onToggle: () => {},
    onGroupChange: () => {},
  });
  const { items, selectedIcon } = menu.props.parentList;
  expect(selectedIcon).toBe(items[0].icon);
  // The image icon keeps its identity across renders and draws the extension's own image.
  const image = items[0].icon({ className: "icon" });
  expect(image.props.children.props).toMatchObject({ src: svg, alt: "", className: "icon" });
  expect(items[1].icon).not.toBe(items[0].icon);
});
