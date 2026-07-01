import { Box, Container } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ParamEditor } from "./param-editor";
import type { InputGroup, ParamValueMap } from "./param-editor.types";

const authoringGroups: InputGroup[] = [
  {
    id: "layout",
    title: "Layout",
    description: "Position and sizing.",
    collapsible: true,
    params: [
      { id: "anchor", name: "Anchor", type: "anchorGrid", defaultValue: "center" },
      {
        id: "offset",
        name: "Offset",
        type: "vector",
        description: "Cartesian x/y offset.",
        defaultValue: { x: 0, y: 0 },
        xLabel: "X",
        yLabel: "Y",
        min: -100,
        max: 100,
        step: 1,
      },
    ],
  },
  {
    id: "numeric",
    title: "Numeric",
    description: "Numbers, sliders, and ranges.",
    collapsible: true,
    params: [
      {
        id: "opacity",
        name: "Opacity",
        type: "number",
        defaultValue: 72,
        min: 0,
        max: 100,
        step: 5,
      },
      {
        id: "blur",
        name: "Blur",
        type: "number",
        description: "Continuous with a value label.",
        defaultValue: 4,
        min: 0,
        max: 40,
      },
      { id: "trim", name: "Trim", type: "range", defaultValue: [12, 84], min: 0, max: 100, step: 1, unit: "%" },
    ],
  },
  {
    id: "mode",
    title: "Mode & actions",
    description: "Segmented and action controls.",
    collapsible: true,
    params: [
      {
        id: "quality",
        name: "Quality",
        type: "segmented",
        defaultValue: "balanced",
        options: [
          { id: "draft", name: "Draft" },
          { id: "balanced", name: "Balanced" },
          { id: "detailed", name: "Detailed" },
        ],
      },
      {
        id: "channel",
        name: "Channel",
        type: "segmented",
        variant: "dots",
        defaultValue: "green",
        options: [
          { id: "red", name: "R", indicatorColor: "#ef4444" },
          { id: "green", name: "G", indicatorColor: "#22c55e" },
          { id: "blue", name: "B", indicatorColor: "#3b82f6" },
        ],
      },
      {
        id: "align",
        name: "Align",
        type: "actions",
        options: [
          { id: "left", name: "Left" },
          { id: "center", name: "Center" },
          { id: "right", name: "Right" },
          { id: "justify", name: "Justify", disabled: true },
        ],
      },
    ],
  },
  {
    id: "media",
    title: "Media",
    description: "Files and color.",
    collapsible: true,
    params: [
      {
        id: "source",
        name: "Source image",
        type: "fileDrop",
        assetKind: "image",
        accept: "image/*",
        defaultValue: null,
      },
      { id: "tint", name: "Tint", type: "color", defaultValue: "#0c8ce9" },
    ],
  },
  {
    id: "references",
    title: "References",
    description: "Resources rendered as tags — editable dropdowns or view-only chips.",
    collapsible: true,
    params: [
      {
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
      },
      {
        id: "labels",
        name: "Labels",
        type: "resource",
        editable: true,
        multiSelect: true,
        placeholder: "Add label",
        defaultValue: ["bug"],
        options: [
          { id: "bug", name: "Bug", icon: "bug", color: "red" },
          { id: "feature", name: "Feature", icon: "sparkles", color: "purple" },
          { id: "docs", name: "Docs", icon: "book-open", color: "blue" },
        ],
      },
      {
        id: "reference-id",
        name: "ID",
        type: "resource",
        emptyText: "None",
        defaultValue: "PS-42",
        options: [{ id: "PS-42", name: "PS-42", icon: "circle", copyText: "PS-42" }],
      },
      {
        id: "links",
        name: "Links",
        type: "resource",
        multiSelect: true,
        emptyText: "None",
        defaultValue: ["dep-1", "pr-7"],
        options: [
          { id: "dep-1", name: "PS-7", icon: "circle", ref: { type: "ticket", id: "PS-7" } },
          { id: "pr-7", name: "PR #7", icon: "code", href: "https://example.com/pr/7" },
        ],
      },
    ],
  },
  {
    id: "advanced",
    title: "Advanced",
    description: "Text transform.",
    collapsible: true,
    defaultCollapsed: true,
    params: [
      {
        id: "transform",
        name: "Transform",
        description: "Runs against each selected item.",
        type: "text",
        singleLine: false,
        defaultValue: "return item.title.trim();",
      },
    ],
  },
];

const initialValues: ParamValueMap = {
  anchor: "center",
  offset: { x: 0, y: 0 },
  opacity: 72,
  blur: 4,
  trim: [12, 84],
  quality: "balanced",
  channel: "green",
  tint: "#0c8ce9",
  transform: "return item.title.trim();",
  status: "in-progress",
  labels: ["bug"],
  "reference-id": "PS-42",
  links: ["dep-1", "pr-7"],
};

interface InspectorPreviewProps {
  groups: InputGroup[];
  initial: ParamValueMap;
  readOnly?: boolean;
}

const InspectorPreview = (props: InspectorPreviewProps) => {
  const { groups, initial, readOnly } = props;
  const [values, setValues] = useState<ParamValueMap>(initial);

  return (
    <Container padding="md">
      <Box
        maxWidth="360px"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="xs"
        bg="bg.subtle"
        overflow="hidden"
      >
        <ParamEditor
          groups={groups}
          defaultValues={values}
          readOnly={readOnly}
          fullWidth
          onChange={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
          onOpenResource={() => {}}
        />
      </Box>
    </Container>
  );
};

const meta = {
  title: "Components/Inputs/Param Editor/Controls",
  component: ParamEditor,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ParamEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AuthoringControls: Story = {
  render: () => <InspectorPreview groups={authoringGroups} initial={initialValues} />,
};

export const ReadOnly: Story = {
  render: () => <InspectorPreview groups={authoringGroups} initial={initialValues} readOnly />,
};
