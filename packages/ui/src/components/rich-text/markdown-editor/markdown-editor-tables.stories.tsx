import { Box, Grid, Text, Textarea } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MarkdownEditor } from "./markdown-editor";
import {
  difficultMarkdownTableFixture,
  largeMarkdownTableFixture,
  preservedCommentFixture,
} from "./markdown-table.story-fixture";

interface EditableTableDemoProps {
  initialValue: string;
}

const EditableTableDemo = (props: EditableTableDemoProps) => {
  const { initialValue } = props;
  const [markdown, setMarkdown] = useState(initialValue);

  return (
    <Grid gridTemplateRows="minmax(0, 1fr) auto" height="calc(100vh - var(--chakra-spacing-lg))" gap="sm">
      <Box minHeight="0" borderWidth="1px" borderColor="border.subtle" borderRadius="md" overflow="hidden">
        <MarkdownEditor defaultState={initialValue} isEditable onChange={setMarkdown} />
      </Box>
      <Box>
        <Text textStyle="label/S/medium" marginBottom="2xs">
          Live emitted Markdown
        </Text>
        <Textarea
          value={markdown}
          readOnly
          autoresize
          maxHeight="48"
          fontFamily="mono"
          textStyle="paragraph/S/regular"
        />
      </Box>
    </Grid>
  );
};

const meta = {
  title: "Patterns/Editors/Markdown Editor/Tables",
  component: MarkdownEditor,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Box padding="sm" background="bg">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof MarkdownEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EditableLargeTable: Story = {
  render: () => <EditableTableDemo initialValue={largeMarkdownTableFixture} />,
};

export const SlashCommands: Story = {
  render: () => <EditableTableDemo initialValue="" />,
};

export const TallImageEditing: Story = {
  render: () => (
    <Box height="calc(100vh - var(--chakra-spacing-lg))" borderWidth="1px" borderColor="border.subtle">
      <MarkdownEditor defaultState="" isEditable />
    </Box>
  ),
};

export const DifficultTableSyntax: Story = {
  render: () => <EditableTableDemo initialValue={difficultMarkdownTableFixture} />,
};

export const HiddenPreservedComments: Story = {
  render: () => <EditableTableDemo initialValue={preservedCommentFixture} />,
};

export const ReadOnlyRenderedContent: Story = {
  args: {
    defaultState: difficultMarkdownTableFixture,
    isEditable: false,
  },
  render: (args) => (
    <Box borderWidth="1px" borderColor="border.subtle" borderRadius="md">
      <MarkdownEditor {...args} />
    </Box>
  ),
};
