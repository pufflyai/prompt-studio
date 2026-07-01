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
    description: "Sliders, units, and ranges.",
    collapsible: true,
    params: [
      {
        id: "opacity",
        name: "Opacity",
        type: "slider",
        defaultValue: 72,
        min: 0,
        max: 100,
        step: 5,
        unit: "%",
        markerCount: 5,
        variant: "discrete",
        baseValue: 100,
      },
      {
        id: "blur",
        name: "Blur",
        type: "slider",
        description: "Continuous with a value label.",
        defaultValue: 4,
        min: 0,
        max: 40,
        unit: "px",
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
      { id: "tint", name: "Tint", type: "colorOpacity", defaultValue: { hex: "#0c8ce9", opacity: 60 } },
    ],
  },
  {
    id: "advanced",
    title: "Advanced",
    description: "Code transform.",
    collapsible: true,
    defaultCollapsed: true,
    params: [
      {
        id: "transform",
        name: "Transform",
        description: "Runs against each selected item.",
        type: "code",
        language: "ts",
        minRows: 5,
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
  tint: { hex: "#0c8ce9", opacity: 60 },
  transform: "return item.title.trim();",
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
