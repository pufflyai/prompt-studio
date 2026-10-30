import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
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
} satisfies CanvasMeta<typeof SelectionInput>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const BranchChoices: Story = {
  id: "patterns-param-editor-selection--branch-choices",
};
export const StatusChoices: Story = {
  id: "patterns-param-editor-selection--status-choices",
  args: {
    id: "status",
    name: "Eligible statuses",
    defaultValue: ["todo"],
    multiSelect: true,
    searchable: true,
    options: [
      { id: "todo", name: "Todo", icon: "status-todo", color: "gray" },
      { id: "building", name: "Building", icon: "status-progress", color: "blue" },
      { id: "done", name: "Delivered", icon: "status-done", color: "green" },
    ],
  },
};
export const OnlySelectedOption: Story = {
  id: "patterns-param-editor-selection--only-selected-option",
  args: { options: [main] },
};
export const EffortLevels: Story = {
  id: "patterns-param-editor-selection--effort-levels",
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
  id: "patterns-param-editor-selection--no-options",
  args: { options: [], defaultValue: "" },
};
export const OnlyUnsetOption: Story = {
  id: "patterns-param-editor-selection--only-unset-option",
  args: { options: [main], defaultValue: "" },
};
export const OptionalSelection: Story = {
  id: "patterns-param-editor-selection--optional-selection",
  args: { options: [main], clearable: true },
};
export const MultiSelection: Story = {
  id: "patterns-param-editor-selection--multi-selection",
  args: { options: [main], defaultValue: ["main"], multiSelect: true },
};
export const UnavailableAlternatives: Story = {
  id: "patterns-param-editor-selection--unavailable-alternatives",
  args: { options: [main, { ...develop, disabled: true }], searchable: true },
};
export const AllOptionsUnavailable: Story = {
  id: "patterns-param-editor-selection--all-options-unavailable",
  args: { options: [{ ...main, disabled: true }], defaultValue: "", clearable: true },
};
export const IconlessChoices: Story = {
  id: "patterns-param-editor-selection--iconless-choices",
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
  id: "patterns-param-editor-selection--change-group",
  args: { options: [main], group },
};
export const EmptyGroup: Story = {
  id: "patterns-param-editor-selection--empty-group",
  args: { options: [], defaultValue: "", group },
};
export const UnavailableGroups: Story = {
  id: "patterns-param-editor-selection--unavailable-groups",
  args: { options: [main], group: { ...group, options: [group.options[0], { ...group.options[1], disabled: true }] } },
};
export const OnlyUnsetGroup: Story = {
  id: "patterns-param-editor-selection--only-unset-group",
  args: { options: [], defaultValue: "", group: { ...group, options: [group.options[0]], defaultValue: "" } },
};
export const CustomChoices: Story = {
  id: "patterns-param-editor-selection--custom-choices",
  args: { allowCustomValues: true, multiSelect: true, defaultValue: ["custom,value"], options: [main, develop] },
};
