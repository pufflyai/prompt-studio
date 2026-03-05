import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { DocsSidebarItem } from "../data/api";
import { DocsSidebar } from "./docs-sidebar";

const demoItems: DocsSidebarItem[] = [
  {
    text: "Getting Started",
    items: [
      { text: "Overview", link: "overview" },
      { text: "Installation", link: "installation" },
      { text: "Quickstart", link: "quickstart" },
    ],
  },
  {
    text: "Guides",
    items: [
      {
        text: "Projects",
        items: [
          { text: "Create a project", link: "guides/projects/create" },
          { text: "Project settings", link: "guides/projects/settings" },
        ],
      },
      {
        text: "Pipelines",
        items: [
          { text: "Author a pipeline", link: "guides/pipelines/author" },
          { text: "Run a pipeline", link: "guides/pipelines/run" },
        ],
      },
    ],
  },
  {
    text: "Reference",
    items: [
      { text: "CLI", link: "reference/cli" },
      { text: "API", link: "reference/api" },
      { text: "Config schema", link: "reference/config" },
    ],
  },
];

const meta: Meta<typeof DocsSidebar> = {
  title: "Documentation/DocsSidebar",
  component: DocsSidebar,
  decorators: [
    (Story) => (
      <Box height="520px" width="320px" p="sm" bg="background.primary" borderWidth="1px" borderColor="border.secondary">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof DocsSidebar>;

export const Default: Story = {
  render: () => {
    const [activeLink, setActiveLink] = useState<string | null>("overview");

    return <DocsSidebar menuItems={demoItems} activeLink={activeLink} onSelectLink={setActiveLink} />;
  },
};

export const Empty: Story = {
  args: {
    menuItems: [],
    activeLink: null,
    onSelectLink: () => {},
  },
};
