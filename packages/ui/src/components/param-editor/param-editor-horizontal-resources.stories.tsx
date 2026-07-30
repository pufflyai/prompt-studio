import { Container } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { FileUploadValue, InputGroup, Param } from "./param-editor.types";
import { ParamEditorHorizontal } from "./param-editor-horizontal";

const labels: Param = {
  id: "labels",
  name: "Labels",
  type: "resource",
  description: "Editable labels use compact chips.",
  editable: true,
  multiSelect: true,
  placeholder: "Add label",
  defaultValue: ["bug", "docs"],
  options: [
    { id: "bug", name: "Bug" },
    { id: "docs", name: "Docs" },
    { id: "feature", name: "Feature" },
  ],
};

const references: Param = {
  id: "references",
  name: "References",
  type: "resource",
  description: "References open their owning resource.",
  multiSelect: true,
  defaultValue: ["ticket", "pull-request"],
  options: [
    { id: "ticket", name: "PS-42", icon: "ticket", ref: { type: "ticket", id: "PS-42" } },
    { id: "pull-request", name: "PR #7", icon: "git-pull-request", href: "https://example.com/pull/7" },
  ],
};

const attachment = new File([new Uint8Array(128 * 1024)], "brief.pdf", {
  type: "application/pdf",
  lastModified: 1,
});
const attachmentValue: FileUploadValue[] = [
  {
    id: "brief",
    file: attachment,
    status: "complete",
  },
];

const groups: InputGroup[] = [
  {
    id: "automation",
    title: "Automation",
    params: [
      {
        id: "automation",
        name: "Automation",
        type: "boolean",
        defaultValue: true,
      },
    ],
  },
  {
    id: "trim",
    title: "Trim",
    params: [
      {
        id: "trim",
        name: "Trim",
        type: "range",
        defaultValue: [12, 84],
        min: 0,
        max: 100,
        unit: "%",
      },
    ],
  },
  {
    id: "attachment",
    title: "Attachment",
    params: [
      {
        id: "attachment",
        name: "Attachment",
        type: "fileUpload",
        uploadLabel: "Attach files",
        defaultValue: attachmentValue,
      },
    ],
  },
];

const meta = {
  title: "Patterns/Param Editor/Param Editor Horizontal",
  component: ParamEditorHorizontal,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ParamEditorHorizontal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ResourceControls: Story = {
  render: (props) => (
    <Container padding="md" maxWidth="none">
      <ParamEditorHorizontal {...props} />
    </Container>
  ),
  args: {
    params: [labels, references],
    groups,
    defaultValues: {
      labels: ["bug", "docs"],
      references: ["ticket", "pull-request"],
      automation: true,
      trim: [12, 84],
      attachment: attachmentValue,
    },
    onChange: () => {},
    onOpenResource: () => {},
  },
};
