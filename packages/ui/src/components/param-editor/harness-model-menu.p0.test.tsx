import { expect, test } from "bun:test";
import { HarnessModelMenu } from "./harness-model-menu";

test("an open harness menu cannot change model or harness when its controls become disabled", () => {
  const selected: string[] = [];
  const props = {
    agentOptions: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    selectedAgent: "a",
    onSelectAgent: (id: string) => selected.push(id),
    modelOptions: [
      { value: "one", label: "One" },
      { value: "two", label: "Two" },
    ],
    selectedModel: "one",
    onSelectModel: (id: string) => selected.push(id),
    isDisabled: true,
  };
  const model = HarnessModelMenu(props);
  expect(model.props.items.every((item: { isDisabled?: boolean }) => item.isDisabled)).toBe(true);
  model.props.items[1].onSelect?.();
  model.props.parentList.onSelect({ id: "b" });
  const agent = HarnessModelMenu({ ...props, offersModels: false });
  expect(agent.props.items.every((item: { isDisabled?: boolean }) => item.isDisabled)).toBe(true);
  agent.props.items[1].onSelect?.();
  expect(selected).toEqual([]);
});

test("harness choices and the selected row use the owning extension icon, with an absent-icon fallback", () => {
  const CustomIcon = () => null;
  const props = {
    agentOptions: [
      { value: "acme.agent", label: "Custom", icon: CustomIcon },
      { value: "bare", label: "Bare" },
    ],
    selectedAgent: "acme.agent",
    onSelectAgent: () => {},
    modelOptions: [{ value: "one", label: "One" }],
    selectedModel: "one",
    onSelectModel: () => {},
  };
  const menu = HarnessModelMenu(props);
  expect(menu.props.parentList.items[0].icon).toBe(CustomIcon);
  expect(menu.props.parentList.selectedIcon).toBe(CustomIcon);
  const missing = HarnessModelMenu({ ...props, selectedAgent: "bare" });
  expect(missing.props.parentList.selectedIcon).toBe(missing.props.parentList.items[1].icon);
});
