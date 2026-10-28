import { Button } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { HostStorageProvider } from "../../utils/host-storage";
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
} satisfies CanvasMeta<typeof KanbanRendererCreateDialog>;
export default meta;
type Story = CanvasVariant<typeof meta>;
const Harness = (props: {
  config: KanbanRendererCreateRowConfig;
  onSubmit?: (submission: KanbanRendererCreateSubmission) => Promise<void> | void;
}) => {
  const { config, onSubmit } = props;
  const [open, setOpen] = useState(true);
  const [storage] = useState(() => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
  });
  return (
    <HostStorageProvider storage={storage}>
      <Button onClick={() => setOpen(true)}>New ticket</Button>
      <KanbanRendererCreateDialog
        open={open}
        columnId="ready"
        columnAttributeId="status"
        attributes={attributes}
        config={config}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit ?? (() => undefined)}
      />
    </HostStorageProvider>
  );
};
/** Empty: submit is blocked because the required markdown field has no content. */
export const Empty: Story = {
  id: "patterns-kanban-renderer-create-dialog--empty",
  args: {} as never,
  render: () => <Harness config={config} />,
};
/** Status is pre-selected from the column and locked; the other properties are free. */
export const PrefilledFromColumn: Story = {
  id: "patterns-kanban-renderer-create-dialog--prefilled-from-column",
  args: {} as never,
  render: () => (
    <Harness config={{ ...config, fields: [{ ...config.fields[0], defaultValue: "Ticket body" }, config.fields[1]] }} />
  ),
};
export const LongDescription: Story = {
  id: "patterns-kanban-renderer-create-dialog--long-description",
  args: {} as never,
  render: () => (
    <Harness
      config={{
        ...config,
        fields: [
          {
            ...config.fields[0],
            defaultValue: Array.from(
              { length: 40 },
              (_, index) => `Requirement ${index + 1}: Keep the ticket details accessible while editing.`,
            ).join("\n\n"),
          },
          config.fields[1],
        ],
      }}
    />
  ),
};
/** Submitting: every control is disabled while the create command runs. */
export const Submitting: Story = {
  id: "patterns-kanban-renderer-create-dialog--submitting",
  args: {} as never,
  render: () => (
    <Harness
      config={{ ...config, fields: [{ ...config.fields[0], defaultValue: "Ticket body" }, config.fields[1]] }}
      onSubmit={() => new Promise(() => undefined)}
    />
  ),
};
/** A failing submit surfaces the caller-supplied error copy. */
export const SubmitError: Story = {
  id: "patterns-kanban-renderer-create-dialog--submit-error",
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
  id: "patterns-kanban-renderer-create-dialog--attributes-only",
  args: {} as never,
  render: () => <Harness config={{ ...config, fields: [] }} />,
};
/** Cancel suspends the draft so reopening does not lose the user's work. */
export const RetainedDraft: Story = {
  id: "patterns-kanban-renderer-create-dialog--retained-draft",
  args: {} as never,
  render: () => <Harness config={config} />,
};
/** Choosing the split-button mode never submits and survives closing the dialog. */
export const RememberedCreateAction: Story = {
  id: "patterns-kanban-renderer-create-dialog--remembered-create-action",
  args: {} as never,
  render: () => <Harness config={config} />,
};
