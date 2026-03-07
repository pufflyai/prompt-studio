import { Box, Flex } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { DocsOutline } from "./docs-outline";
import { MarkdownEditor } from "./rich-text/markdown-editor/markdown-editor";

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

const meta: Meta<typeof DocsOutline> = {
  title: "Documentation/DocsOutline",
  component: DocsOutline,
  decorators: [
    (Story) => (
      <Box height="520px" bg="bg" borderWidth="1px" borderColor="border.secondary">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof DocsOutline>;

export const Default: Story = {
  args: { markdown: demoMarkdown },
};

export const Empty: Story = {
  args: { markdown: "No headings in this document." },
};

export const WithContent: Story = {
  render: () => (
    <Flex height="100%">
      <Box flex="1" overflowY="auto">
        <MarkdownEditor defaultState={demoMarkdown} isEditable={false} />
      </Box>
      <DocsOutline markdown={demoMarkdown} />
    </Flex>
  ),
};
