import { Box } from "@chakra-ui/react";
import { CircleDashed, Diamond, Hexagon, Square } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { TagEditor } from "./tag-editor";
import type { TagEditorValue } from "./tag-editor.types";

type StoryFn = () => ReactNode;

const initialItems = [
  { id: "wip", name: "wip", color: "blue", icon: "clock", sortOrder: 10 },
  { id: "blocked", name: "blocked", color: "red", icon: "alert-triangle", sortOrder: 20 },
  { id: "review-ready", name: "review-ready", color: "yellow", icon: "eye", sortOrder: 30 },
] satisfies TagEditorValue[];
const customIcons = [
  { value: null, label: "circle", icon: CircleDashed },
  { value: "diamond", label: "diamond", icon: Diamond },
  { value: "hexagon", label: "hexagon", icon: Hexagon },
  { value: "square", label: "square", icon: Square },
];

const meta = {
  title: "Components/Inputs/Tag Editor",
  component: TagEditor,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="lg" background="bg" maxWidth="720px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

export const WithIcons = {
  render: () => {
    const [values, setValues] = useState<TagEditorValue[]>(initialItems);

    return (
      <TagEditor
        title="Workspace statuses"
        description="Manage status options used by workspace automations."
        values={values}
        onValuesChange={setValues}
        hasChanges
        onSave={() => undefined}
        onCancel={() => setValues(initialItems)}
      />
    );
  },
};

export const WithDefault = {
  render: () => {
    const [values, setValues] = useState<TagEditorValue[]>([
      { id: "todo", name: "todo", color: "gray", sortOrder: 10, isDefault: true },
      { id: "doing", name: "doing", color: "blue", sortOrder: 20 },
      { id: "done", name: "done", color: "green", sortOrder: 30 },
    ]);

    return (
      <TagEditor
        title="Attempt statuses"
        description="Manage status options used for workspace attempt workflows."
        values={values}
        onValuesChange={setValues}
        onSetDefault={(value) => setValues(values.map((status) => ({ ...status, isDefault: status.id === value.id })))}
        hasChanges
        showDefault
        showIcons={false}
        onSave={() => undefined}
        onCancel={() => undefined}
      />
    );
  },
};

export const WithActions = {
  render: () => {
    const [values, setValues] = useState<TagEditorValue[]>([
      {
        id: "backlog",
        name: "backlog",
        color: "gray",
        sortOrder: 10,
        isDefault: true,
        actions: ["create_ticket", "drag_in", "drag_out"],
      },
      { id: "ready", name: "ready", color: "green", sortOrder: 20, actions: ["drag_in", "drag_out"] },
      { id: "done", name: "done", color: "green", sortOrder: 30, actions: ["drag_out", "archive_all"] },
    ]);

    return (
      <TagEditor
        title="Ticket statuses"
        description="Manage status columns and board actions."
        values={values}
        onValuesChange={setValues}
        actionOptions={[
          { value: "create_ticket", label: "Create ticket" },
          { value: "drag_in", label: "Drag in" },
          { value: "drag_out", label: "Drag out" },
          { value: "archive_all", label: "Archive all" },
        ]}
        hasChanges
        showDefault
        showIcons={false}
        onSetDefault={(value) => setValues(values.map((status) => ({ ...status, isDefault: status.id === value.id })))}
        onSave={() => undefined}
        onCancel={() => undefined}
      />
    );
  },
};

export const CustomPickerOptions = {
  render: () => {
    const [values, setValues] = useState<TagEditorValue[]>([
      { id: "vip", name: "vip", color: "pink", icon: "diamond", sortOrder: 10 },
      { id: "internal", name: "internal", color: "teal", icon: "hexagon", sortOrder: 20 },
    ]);

    return (
      <TagEditor
        title="Ticket tags"
        description="Manage tag values with a custom palette."
        values={values}
        onValuesChange={setValues}
        colorOptions={["pink", "teal", "cyan", "purple"]}
        iconOptions={customIcons}
        addLabel="Add value"
        addPlaceholder="Value name"
        hasChanges
        onSave={() => undefined}
        onCancel={() => undefined}
      />
    );
  },
};
