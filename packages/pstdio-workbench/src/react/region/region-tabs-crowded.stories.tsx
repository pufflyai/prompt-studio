import { Box, Text } from "@chakra-ui/react";
import type { PageRef } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createCrowdedWorkbench = () => {
  const page: PageRef = { extensionId: "storybook", kind: "page", id: "crowded-tabs" };
  const workbench = createWorkbench({ startPage: page, defaultPanelOpenByRegionId: { secondary: true } });
  workbench.modes.registerMode({ id: "crowded", label: "Crowded tabs", activate: () => undefined });
  const labels = [
    "Diff",
    "Preview",
    "a-very-long-resource-name-component.tsx",
    "Terminal",
    "Session notes for review",
    "Docs",
    "Research findings",
    "Design",
  ];
  for (const [index, title] of labels.entries()) {
    workbench.views.registerView({
      id: `tab-${index}`,
      title,
      icon: "file",
      body: { kind: "react", render: () => <Text p="md">{title}</Text> },
    });
  }
  workbench.pages.registerPage({
    id: "crowded-tabs",
    ref: page,
    title: "Crowded tabs",
    path: "crowded-tabs",
    modeId: "crowded",
    main: { kind: "view", view: { kind: "view", id: "tab-0" }, cardinality: "one" },
    slots: labels.map((_, index) => ({
      id: `slot-${index}`,
      region: "secondary",
      item: { kind: "view", view: { kind: "view", id: `tab-${index}` }, presence: "open" },
    })),
  });
  workbench.pageLocations.switchProject("crowded-tabs");
  return workbench;
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Crowded panel tabs",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SharedWidth: Story = {
  args: { workbench: createCrowdedWorkbench() },
  render: (args) => (
    <ChakraProvider value={psTheme}>
      <Box width="3xl">
        <WorkbenchStory {...args} />
      </Box>
    </ChakraProvider>
  ),
};
export const MinimumWidth: Story = {
  args: { workbench: createCrowdedWorkbench() },
  render: (args) => (
    <ChakraProvider value={psTheme}>
      <Box width="sm">
        <WorkbenchStory {...args} />
      </Box>
    </ChakraProvider>
  ),
};
