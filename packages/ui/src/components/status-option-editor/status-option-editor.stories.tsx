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
  title: "Components/StatusOptionEditor",
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
