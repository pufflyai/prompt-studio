import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { DocsTemplateRenderer } from "./docs-template-renderer";

const changelogMarkdown = `# Changelog
Latest product updates.

---
## v1.2.0
**Date:** Mar 19, 2026
**Title:** Docs templates
**Tags:** new, docs

Added template-aware docs rendering.

### Changes
- **Render changelog docs in timeline view** — The docs panel now supports template specific rendering.
- **Fallback for unknown templates** — Unknown templates still render with markdown viewer.
`;

const genericMarkdown = `# Getting Started

This page should render with the markdown viewer.
`;

const meta: Meta<typeof DocsTemplateRenderer> = {
  title: "Documentation/DocsTemplateRenderer",
  component: DocsTemplateRenderer,
  decorators: [
    (Story) => (
      <Box minHeight="100vh" bg="bg" py="16">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof DocsTemplateRenderer>;

export const ChangelogTemplate: Story = {
  args: {
    content: changelogMarkdown,
    template: "changelog",
    markdownPlaceholder: "No docs content.",
  },
};

export const MarkdownFallback: Story = {
  args: {
    content: genericMarkdown,
    template: "unknown-template",
    markdownPlaceholder: "No docs content.",
  },
};
