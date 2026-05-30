import type { Meta, StoryObj } from "@storybook/react";
import { PromptEditor, type ReferenceItem } from "./prompt-input";

const sampleReferences: ReferenceItem[] = [
  { resourceId: "table:users", resourceType: "table", name: "Users", description: "prod.users" },
  { resourceId: "table:sessions", resourceType: "table", name: "Sessions", description: "prod.sessions_v2" },
  {
    resourceId: "connector:bigquery",
    resourceType: "connector",
    name: "BigQuery",
    description: "Analytics",
  },
];

const initialState = JSON.stringify(
  {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text: "Type your query here or press / to add a reference.",
              type: "text",
              version: 1,
            },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  },
  null,
  2,
);

const meta: Meta<typeof PromptEditor> = {
  title: "Patterns/Editors/Prompt Editor",
  component: PromptEditor,
  parameters: {
    layout: "padded",
  },
  args: {
    defaultState: initialState,
    debug: false,
    isEditable: true,
    references: sampleReferences,
    onChange: (text: string) => console.log("onChange:", text),
    onError: (error: Error) => console.error(error),
    onAddReference: (resourceId: string, resourceType: ReferenceItem["resourceType"]) =>
      console.log("reference added:", resourceId, resourceType),
  },
  argTypes: {
    defaultState: {
      control: "text",
      description: "Serialized Lexical editor state (JSON string)",
    },
    isEditable: { control: "boolean" },
    debug: { control: "boolean" },
  },
};

export default meta;

type Story = StoryObj<typeof PromptEditor>;

export const Basic: Story = {};

export const ReadOnly: Story = {
  args: { isEditable: false },
};

export const DebugView: Story = {
  args: { debug: true },
};
