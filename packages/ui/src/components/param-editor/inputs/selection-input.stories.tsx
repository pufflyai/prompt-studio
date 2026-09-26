import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { SelectionInput } from "./selection-input";

const main = { id: "main", name: "main", icon: "git-commit-horizontal" };
const develop = { id: "develop", name: "develop", icon: "git-commit-horizontal" };
const meta = {
  title: "Patterns/Param Editor/Selection",
  component: SelectionInput,
  args: {
    id: "base",
    name: "Base branch",
    description: "",
    defaultValue: "main",
    options: [main, develop],
    onChange: () => {},
  },
} satisfies Meta<typeof SelectionInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const BranchChoices: Story = {};
export const OnlySelectedOption: Story = {
  args: { options: [main] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "main" })).toBeDisabled();
  },
};
export const EffortLevels: Story = {
  args: {
    id: "effort",
    name: "Reasoning effort",
    defaultValue: "medium",
    options: [
      { id: "low", name: "Low", icon: "level-low" },
      { id: "medium", name: "Medium", icon: "level-mid" },
      { id: "high", name: "High", icon: "level-high" },
      { id: "xhigh", name: "Extra high", icon: "level-xhigh" },
    ],
  },
};
export const NoOptions: Story = {
  args: { options: [], defaultValue: "" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Select" })).toBeDisabled();
  },
};
export const OnlyUnsetOption: Story = {
  args: { options: [main], defaultValue: "" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Select" }));
    await userEvent.click(page.getByRole("menuitemradio", { name: "main" }));
    await expect(canvas.getByRole("button", { name: "main" })).toBeDisabled();
  },
};
export const OptionalSelection: Story = {
  args: { options: [main], clearable: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "main" }));
    await userEvent.click(page.getByRole("menuitemradio", { name: "main" }));
    await expect(canvas.getByRole("button", { name: "Select" })).toBeEnabled();
  },
};
export const MultiSelection: Story = {
  args: { options: [main], defaultValue: ["main"], multiSelect: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "main" }));
    await userEvent.click(page.getByRole("menuitemcheckbox", { name: "main" }));
    await expect(canvas.getByRole("button", { name: "Select" })).toBeEnabled();
  },
};
export const UnavailableAlternatives: Story = {
  args: { options: [main, { ...develop, disabled: true }], searchable: true },
  play: OnlySelectedOption.play,
};
export const AllOptionsUnavailable: Story = {
  args: { options: [{ ...main, disabled: true }], defaultValue: "", clearable: true },
  play: NoOptions.play,
};
export const IconlessChoices: Story = {
  args: {
    options: [
      { id: "main", name: "main" },
      { id: "develop", name: "develop" },
    ],
    searchable: true,
  },
};

const group = {
  id: "repository",
  name: "Repository",
  defaultValue: "app",
  options: [
    { id: "app", name: "App", icon: "folder" },
    { id: "docs", name: "Docs", icon: "folder" },
  ],
};
export const ChangeGroup: Story = {
  args: { options: [main], group },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "main" }));
    await userEvent.click(page.getByRole("menuitem", { name: "Repository" }));
    await userEvent.click(page.getByRole("menuitem", { name: "Docs" }));
    await expect(canvas.getByRole("button", { name: "main" })).toBeEnabled();
  },
};
export const EmptyGroup: Story = { args: { options: [], defaultValue: "", group } };
export const UnavailableGroups: Story = {
  args: { options: [main], group: { ...group, options: [group.options[0], { ...group.options[1], disabled: true }] } },
  play: OnlySelectedOption.play,
};
export const OnlyUnsetGroup: Story = {
  args: { options: [], defaultValue: "", group: { ...group, options: [group.options[0]], defaultValue: "" } },
};
