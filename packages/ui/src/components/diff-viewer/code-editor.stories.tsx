import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { CodeDiffEditor, CodeEditor } from "./code-editor";

const meta = {
  title: "Patterns/Editors/Code Editor",
  component: CodeEditor,
  decorators: [
    (Story) => (
      <Box height="2xl" width="full">
        <Story />
      </Box>
    ),
  ],
  args: {
    language: "typescript",
    defaultCode: "export const greeting = 'Hello';\n",
    isEditable: true,
    showLineNumbers: true,
  },
} satisfies Meta<typeof CodeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {};

export const ReadOnly: Story = { args: { isEditable: false } };

export const Diff: Story = {
  render: () => (
    <CodeDiffEditor
      language="typescript"
      original={"export const greeting = 'Hello';\n"}
      modified={"export const greeting = 'Welcome';\n"}
      showLineNumbers
    />
  ),
};
