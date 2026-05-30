import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { StatusOptionEditor } from "./status-option-editor";
import type { StatusOptionEditorItem } from "./status-option-editor.types";

type StoryFn = () => ReactNode;

const initialItems = [
  { id: "wip", name: "wip", color: "blue", icon: "clock", sortOrder: 10 },
  { id: "blocked", name: "blocked", color: "red", icon: "alert-triangle", sortOrder: 20 },
  { id: "review-ready", name: "review-ready", color: "yellow", icon: "eye", sortOrder: 30 },
] satisfies StatusOptionEditorItem[];

const meta = {
  title: "Components/Inputs/Status Option Editor",
  component: StatusOptionEditor,
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
    const [items, setItems] = useState<StatusOptionEditorItem[]>(initialItems);

    return (
      <StatusOptionEditor
        title="Workspace statuses"
        description="Manage status options used by workspace automations."
        items={items}
        onItemsChange={setItems}
        hasChanges
        onSave={() => undefined}
        onCancel={() => setItems(initialItems)}
      />
    );
  },
};

export const WithDefault = {
  render: () => {
    const [items, setItems] = useState<StatusOptionEditorItem[]>([
      { id: "todo", name: "todo", color: "gray", sortOrder: 10, isDefault: true },
      { id: "doing", name: "doing", color: "blue", sortOrder: 20 },
      { id: "done", name: "done", color: "green", sortOrder: 30 },
    ]);

    return (
      <StatusOptionEditor
        title="Attempt statuses"
        description="Manage status options used for workspace attempt workflows."
        items={items}
        onItemsChange={setItems}
        onSetDefault={(item) => setItems(items.map((status) => ({ ...status, isDefault: status.id === item.id })))}
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
    const [items, setItems] = useState<StatusOptionEditorItem[]>([
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
      <StatusOptionEditor
        title="Ticket statuses"
        description="Manage status columns and board actions."
        items={items}
        onItemsChange={setItems}
        actionOptions={[
          { value: "create_ticket", label: "Create ticket" },
          { value: "drag_in", label: "Drag in" },
          { value: "drag_out", label: "Drag out" },
          { value: "archive_all", label: "Archive all" },
        ]}
        hasChanges
        showDefault
        showIcons={false}
        onSetDefault={(item) => setItems(items.map((status) => ({ ...status, isDefault: status.id === item.id })))}
        onSave={() => undefined}
        onCancel={() => undefined}
      />
    );
  },
};
