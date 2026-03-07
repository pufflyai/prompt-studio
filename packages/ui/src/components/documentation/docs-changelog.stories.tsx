import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { DocsChangelog, type DocsChangelogEntry } from "./docs-changelog";

const detailedEntries: DocsChangelogEntry[] = [
  {
    title: "Changelog v2.1.0",
    version: "v2.1.0",
    date: "Sep 15, 2025",
    tags: ["new", "improvement"],
    image: "https://placehold.co/960x540",
    description: "Introduced major docs tooling improvements and layout updates.",
    changes: [
      {
        title: "New timeline component",
        description: "Added flexible variants and spacing controls for longer release notes.",
      },
      {
        title: "Dark mode support",
        description: "Aligned semantic color tokens for docs pages.",
      },
      {
        title: "Button focus states",
        description: "Improved accessibility feedback across docs navigation.",
      },
    ],
  },
  {
    title: "Changelog v2.0.3",
    version: "v2.0.3",
    date: "Sep 1, 2025",
    tags: ["bugfix"],
    changes: [
      {
        title: "TypeScript definitions",
        description: "Fixed missing prop types for exported docs components.",
      },
      {
        title: "Modal performance",
        description: "Optimized hydration and reduced jank for large content.",
      },
    ],
  },
  {
    title: "Changelog v2.0.0",
    version: "v2.0.0",
    date: "Aug 20, 2025",
    tags: ["major"],
    description: "Shipped the first full docs block set with breaking API updates.",
    changes: [
      {
        title: "Breaking: new color system",
        description: "Updated token structure for better contrast consistency.",
      },
      {
        title: "Composition API",
        description: "Introduced composition primitives for docs sections.",
      },
    ],
  },
];

const summaryEntries: DocsChangelogEntry[] = [
  {
    title: "Revamped timeline component with new features",
    version: "v2.1.0",
    date: "Sep 15, 2025",
    tags: ["new", "improvement"],
  },
  {
    title: "Studio now supports new documentation components",
    version: "v2.0.3",
    date: "Sep 1, 2025",
    tags: ["studio"],
  },
  {
    title: "Image picker now supports multiple images",
    version: "v2.0.0",
    date: "Aug 20, 2025",
    tags: ["image picker", "studio"],
  },
];

const meta = {
  title: "Documentation/DocsChangelog",
  component: DocsChangelog,
  decorators: [
    (Story) => (
      <Box minHeight="100vh" bg="bg" py="16" px={{ base: "6", md: "10" }}>
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof DocsChangelog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Changelog",
    description: "Stay up to date with the latest changes and improvements.",
    entries: detailedEntries,
  },
};

export const SummaryOnly: Story = {
  args: {
    title: "Product updates",
    description: "A compact changelog view for release announcements.",
    entries: summaryEntries,
  },
};
