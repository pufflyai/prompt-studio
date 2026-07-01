import { Container } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ParamEditor } from "../param-editor";
import type { ResourceParam } from "../param-editor.types";

const status: ResourceParam = {
  id: "status",
  name: "Status",
  type: "resource",
  editable: true,
  defaultValue: "in-progress",
  options: [
    { id: "todo", name: "To do", icon: "circle", color: "gray" },
    { id: "in-progress", name: "In progress", icon: "clock", color: "blue" },
    { id: "done", name: "Done", icon: "check-circle", color: "green" },
  ],
};

const tags: ResourceParam = {
  id: "priority",
  name: "Priority",
  type: "resource",
  editable: true,
  multiSelect: true,
  placeholder: "Add priority",
  defaultValue: ["high"],
  options: [
    { id: "low", name: "Low", icon: "flag", color: "gray" },
    { id: "high", name: "High", icon: "flame", color: "orange" },
    { id: "urgent", name: "Urgent", icon: "alert-triangle", color: "red" },
  ],
};

const id: ResourceParam = {
  id: "id",
  name: "ID",
  type: "resource",
  emptyText: "None",
  defaultValue: "PS-42",
  options: [{ id: "PS-42", name: "PS-42", icon: "circle", copyText: "PS-42" }],
};

const dependsOn: ResourceParam = {
  id: "depends-on",
  name: "Depends on",
  type: "resource",
  multiSelect: true,
  emptyText: "None",
  defaultValue: ["PS-1", "PS-2"],
  options: [
    { id: "PS-1", name: "PS-1", icon: "circle", ref: { type: "ticket", id: "PS-1" } },
    { id: "PS-2", name: "PS-2", icon: "circle", ref: { type: "ticket", id: "PS-2" } },
  ],
};

const reviewLinks: ResourceParam = {
  id: "review-links",
  name: "Review links",
  type: "resource",
  multiSelect: true,
  emptyText: "None",
  defaultValue: ["pr-42"],
  options: [{ id: "pr-42", name: "PR #42", icon: "code", href: "https://example.com/pr/42" }],
};

const meta = {
  title: "Components/Inputs/Param Editor/Resource Input",
  component: ParamEditor,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ParamEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Demo: Story = {
  render: (props) => (
    <Container padding="md" maxW="sm">
      <ParamEditor {...props} />
    </Container>
  ),
  args: {
    fullWidth: true,
    onChange: () => {},
    onOpenResource: () => {},
    params: [id, status, tags, dependsOn, reviewLinks],
  },
};
