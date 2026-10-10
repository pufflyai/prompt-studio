import { Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { KanbanRendererCreateDialog } from "./kanban-renderer-create-dialog";
import type { AttributeDescriptor, KanbanRendererCreateRowConfig, KanbanRendererCreateSubmission } from "./types";

const attributes: AttributeDescriptor[] = [
  {
    id: "status",
    label: "Status",
    editable: true,
    type: {
      kind: "enum",
      options: [
        { value: "todo", label: "Todo", color: "gray", icon: "circle" },
        { value: "ready", label: "Ready", color: "blue", icon: "circle" },
        { value: "done", label: "Done", color: "green", icon: "check-circle" },
      ],
    },
  },
  {
    id: "type",
    label: "Type",
    editable: true,
    type: {
      kind: "enum",
      options: [
        { value: "bug", label: "Bug", color: "red", icon: "bug" },
        { value: "feature", label: "Feature", color: "purple", icon: "sparkles" },
      ],
    },
  },
  {
    id: "priority",
    label: "Priority",
    editable: true,
    type: {
      kind: "enum-multi",
      options: [
        { value: "high", label: "High", color: "orange", icon: "flame" },
        { value: "low", label: "Low", color: "teal", icon: "flag" },
      ],
    },
  },
  // Editable but not an enum — the form must still offer it.
  { id: "estimate", label: "Estimate", editable: true, type: { kind: "number" } },
  { id: "created", label: "Created", type: { kind: "date" } },
];

const labels = {
  cancel: "Cancel",
  properties: "Properties",
  submitError: "Could not create ticket",
  removeFile: "Remove file",
  submitWithoutOpening: "Create without opening",
};

const config: KanbanRendererCreateRowConfig = {
  title: "New ticket",
  submitLabel: "Create ticket",
  fields: [
    { id: "content", label: "Description", placeholder: "Describe the ticket...", type: "markdown", required: true },
    { id: "files", label: "Attach files", type: "files", multiple: true },
  ],
  labels,
};

const meta = {
  title: "Patterns/Kanban Renderer/Create Dialog",
  component: KanbanRendererCreateDialog,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof KanbanRendererCreateDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const Harness = (props: {
  config: KanbanRendererCreateRowConfig;
  onSubmit?: (submission: KanbanRendererCreateSubmission) => Promise<void> | void;
}) => {
  const [open, setOpen] = useState(true);

  return (
    <>
      <Button onClick={() => setOpen(true)}>New ticket</Button>
      <KanbanRendererCreateDialog
        open={open}
        columnId="ready"
        columnAttributeId="status"
        attributes={attributes}
        config={props.config}
        onClose={() => setOpen(false)}
        onSubmit={props.onSubmit ?? (() => undefined)}
      />
    </>
  );
};

/** Empty: submit is blocked because the required markdown field has no content. */
export const Empty: Story = {
  args: {} as never,
  render: () => <Harness config={config} />,
};

/** Status is pre-selected from the column and locked; the other properties are free. */
export const PrefilledFromColumn: Story = {
  args: {} as never,
  render: () => (
    <Harness config={{ ...config, fields: [{ ...config.fields[0], defaultValue: "Ticket body" }, config.fields[1]] }} />
  ),
};

/** Submitting: every control is disabled while the create command runs. */
export const Submitting: Story = {
  args: {} as never,
  render: () => <Harness config={config} onSubmit={() => new Promise(() => undefined)} />,
};

/** A failing submit surfaces the caller-supplied error copy. */
export const SubmitError: Story = {
  args: {} as never,
  render: () => (
    <Harness
      config={{ ...config, fields: [{ ...config.fields[0], required: false }, config.fields[1]] }}
      onSubmit={() => {
        throw new Error("Ticket storage is unavailable");
      }}
    />
  ),
};

/** No declared fields: the dialog is just the derived Properties zone. */
export const AttributesOnly: Story = {
  args: {} as never,
  render: () => <Harness config={{ ...config, fields: [] }} />,
};

/** Cancel suspends the draft so reopening does not lose the user's work. */
export const RetainedDraft: Story = {
  args: {} as never,
  render: () => <Harness config={config} />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.type(await body.findByRole("textbox"), "Keep this ticket draft");
    await userEvent.click(body.getByRole("button", { name: "Cancel", exact: true }));
    await userEvent.click(within(canvasElement).getByRole("button", { name: "New ticket", exact: true }));
    await expect(await body.findByRole("textbox")).toHaveTextContent("Keep this ticket draft");
  },
};
