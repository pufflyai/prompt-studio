import { Box, Flex } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { MarkdownEditor } from "../rich-text/markdown-editor/markdown-editor";
import { DocsOutline } from "./docs-outline";

const demoMarkdown = `# Getting Started

Welcome to the documentation.

## Use Cases

Here are some common use cases for this tool.

## Developer Experience

The developer experience is designed to be intuitive.

### IDE Integration

Works with all major IDEs.

## Performance

Performance benchmarks and optimization tips.

### Benchmarks

Detailed benchmark results go here.

## What About VuePress?

A comparison with VuePress and similar tools.
`;

const meta = {
  title: "Documentation/DocsOutline",
  component: DocsOutline,
  decorators: [
    (Story) => (
      <Box height="520px" bg="bg" borderWidth="1px" borderColor="border.secondary">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof DocsOutline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  args: { markdown: demoMarkdown },
};

export const Mobile: Story = {
  decorators: [
    (Story) => (
      <Box width="360px" maxWidth="100%" bg="bg" borderWidth="1px" borderColor="border.secondary">
        <Story />
      </Box>
    ),
  ],
  args: { markdown: demoMarkdown },
};

export const Empty: Story = {
  args: { markdown: "No headings in this document." },
};

export const WithContent: Story = {
  args: {
    markdown: demoMarkdown,
  },
  render: () => (
    <Flex height="100%">
      <Box flex="1" overflowY="auto">
        <MarkdownEditor defaultState={demoMarkdown} isEditable={false} />
      </Box>
      <DocsOutline markdown={demoMarkdown} />
    </Flex>
  ),
};
