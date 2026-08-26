import { Box, Button, HStack, Stack } from "@chakra-ui/react";
import { CircleDashed, Diamond, Hexagon, Square, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { SegmentedControl } from "@/components/primitives/segmented-control";
import { TagEditor } from "./tag-editor";
import type { TagEditorValue } from "./tag-editor.types";
import { TagEditorSaveBar } from "./tag-editor-save-bar";

type StoryFn = () => ReactNode;

const initialItems = [
  { id: "low", name: "Low", color: "gray", icon: "level-low", sortOrder: 10 },
  { id: "medium", name: "Medium", color: "yellow", icon: "level-mid", sortOrder: 20 },
  { id: "high", name: "High", color: "orange", icon: "level-high", sortOrder: 30 },
  { id: "urgent", name: "Urgent", color: "red", icon: "flame", sortOrder: 40 },
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
      <Stack gap="md">
        <TagEditor title="Priority" values={values} onValuesChange={setValues} />
        <TagEditorSaveBar hasChanges onSave={() => undefined} onReset={() => setValues(initialItems)} />
      </Stack>
    );
  },
};

export const Hover = {
  render: () => {
    const [values, setValues] = useState<TagEditorValue[]>(initialItems);

    return <TagEditor title="Priority" values={values} onValuesChange={setValues} />;
  },
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByText("Low"));
  },
};

export const Renaming = {
  render: () => {
    const [values, setValues] = useState<TagEditorValue[]>([
      { id: "new-priority", name: "New option", color: "blue", icon: "circle", sortOrder: 0, isNew: true },
      ...initialItems,
    ]);

    return <TagEditor title="Priority" values={values} onValuesChange={setValues} />;
  },
};

export const ExternalReset = {
  render: () => {
    const [values, setValues] = useState<TagEditorValue[]>(initialItems);

    return (
      <Stack gap="sm">
        <TagEditor title="Priority" values={values} onValuesChange={setValues} />
        <Button size="sm" alignSelf="flex-start" onClick={() => setValues(initialItems)}>
          Reset
        </Button>
      </Stack>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.dblClick(canvas.getByText("Low"));
    const input = canvas.getByDisplayValue("Low");
    await userEvent.clear(input);
    await userEvent.type(input, "Low reviewed{enter}");
    await expect(canvas.getByText("Low reviewed")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reset" }));
    await expect(canvas.getByText("Low")).toBeVisible();
    await expect(canvas.queryByText("Low reviewed")).not.toBeInTheDocument();
  },
};

export const Dragging = {
  render: () => {
    const [values, setValues] = useState<TagEditorValue[]>(initialItems);

    return <TagEditor title="Priority" values={values} onValuesChange={setValues} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.pointer([
      { target: canvas.getByLabelText("Reorder Low"), keys: "[MouseLeft>]" },
      { target: canvas.getByLabelText("Reorder Medium") },
    ]);
  },
};

/** Mirrors the design's editor composite: a mode toggle and delete in the header. */
export const WithHeaderActions = {
  render: () => {
    const [values, setValues] = useState<TagEditorValue[]>(initialItems);
    const [mode, setMode] = useState("single_select");

    return (
      <Stack gap="md">
        <TagEditor
          title="Priority"
          values={values}
          onValuesChange={setValues}
          headerActions={
            <HStack gap="xs">
              <SegmentedControl
                value={mode}
                onValueChange={setMode}
                aria-label="Selection mode"
                options={[
                  { value: "single_select", label: "Single" },
                  { value: "multi_select", label: "Multiple" },
                ]}
              />
              <Button size="xs" variant="ghost" color="fg.subtle" aria-label="Delete tag">
                <Trash2 size={14} />
              </Button>
            </HStack>
          }
        />
        <TagEditorSaveBar hasChanges onSave={() => undefined} onReset={() => setValues(initialItems)} />
      </Stack>
    );
  },
};

export const WithStatusGlyphs = {
  render: () => {
    const [values, setValues] = useState<TagEditorValue[]>([
      { id: "backlog", name: "Backlog", color: "gray", icon: "status-backlog", sortOrder: 10 },
      { id: "todo", name: "Todo", color: "blue", icon: "status-todo", sortOrder: 20 },
      { id: "progress", name: "In progress", color: "yellow", icon: "status-progress", sortOrder: 30 },
      { id: "review", name: "In review", color: "purple", icon: "status-review", sortOrder: 40 },
      { id: "done", name: "Done", color: "green", icon: "status-done", sortOrder: 50 },
      { id: "canceled", name: "Canceled", color: "red", icon: "status-canceled", sortOrder: 60 },
    ]);

    return <TagEditor title="Status" values={values} onValuesChange={setValues} />;
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
        showDefault
        showIcons={false}
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
        showDefault
        showIcons={false}
        onSetDefault={(value) => setValues(values.map((status) => ({ ...status, isDefault: status.id === value.id })))}
      />
    );
  },
};

export const ReadOnly = {
  render: () => <TagEditor title="Release statuses" values={initialItems} onValuesChange={() => undefined} readOnly />,
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
        addName="New value"
      />
    );
  },
};
