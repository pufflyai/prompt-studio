import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";
import { SelectionInput } from "./selection-input";

const main = { id: "main", name: "main", icon: "git-commit-horizontal" };
const develop = { id: "develop", name: "develop", icon: "git-commit-horizontal" };
const meta = {
  title: "Design system/Patterns/Parameter editor/Selection",
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
export default {
  title: "Design system/Patterns/Parameter editor/Selection",
  fullscreen: true,
};
type Story = CanvasFrame<typeof meta>;
const BranchChoices: Story = {
  id: "patterns-param-editor-selection--branch-choices",
};
const StatusChoices: Story = {
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
const OnlySelectedOption: Story = {
  id: "patterns-param-editor-selection--only-selected-option",
  args: { options: [main] },
};
const EffortLevels: Story = {
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
const NoOptions: Story = {
  id: "patterns-param-editor-selection--no-options",
  args: { options: [], defaultValue: "" },
};
const OnlyUnsetOption: Story = {
  id: "patterns-param-editor-selection--only-unset-option",
  args: { options: [main], defaultValue: "" },
};
const OptionalSelection: Story = {
  id: "patterns-param-editor-selection--optional-selection",
  args: { options: [main], clearable: true },
};
const MultiSelection: Story = {
  id: "patterns-param-editor-selection--multi-selection",
  args: { options: [main], defaultValue: ["main"], multiSelect: true },
};
const UnavailableAlternatives: Story = {
  id: "patterns-param-editor-selection--unavailable-alternatives",
  args: { options: [main, { ...develop, disabled: true }], searchable: true },
};
const AllOptionsUnavailable: Story = {
  id: "patterns-param-editor-selection--all-options-unavailable",
  args: { options: [{ ...main, disabled: true }], defaultValue: "", clearable: true },
};
const IconlessChoices: Story = {
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
const ChangeGroup: Story = {
  id: "patterns-param-editor-selection--change-group",
  args: { options: [main], group },
};
const EmptyGroup: Story = {
  id: "patterns-param-editor-selection--empty-group",
  args: { options: [], defaultValue: "", group },
};
const UnavailableGroups: Story = {
  id: "patterns-param-editor-selection--unavailable-groups",
  args: { options: [main], group: { ...group, options: [group.options[0], { ...group.options[1], disabled: true }] } },
};
const OnlyUnsetGroup: Story = {
  id: "patterns-param-editor-selection--only-unset-group",
  args: { options: [], defaultValue: "", group: { ...group, options: [group.options[0]], defaultValue: "" } },
};
const CustomChoices: Story = {
  id: "patterns-param-editor-selection--custom-choices",
  args: { allowCustomValues: true, multiSelect: true, defaultValue: ["custom,value"], options: [main, develop] },
};

const Examples = createCanvasExampleNavigator(meta, {
  BranchChoices,
  StatusChoices,
  OnlySelectedOption,
  EffortLevels,
  NoOptions,
  OnlyUnsetOption,
  OptionalSelection,
  MultiSelection,
  UnavailableAlternatives,
  AllOptionsUnavailable,
  IconlessChoices,
  ChangeGroup,
  EmptyGroup,
  UnavailableGroups,
  OnlyUnsetGroup,
  CustomChoices,
});
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as BranchChoices };
