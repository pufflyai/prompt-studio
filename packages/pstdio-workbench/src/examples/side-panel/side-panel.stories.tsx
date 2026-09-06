import { Input, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { SlidersHorizontal } from "lucide-react";
import { type ReactNode, useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../workbench-story";

interface SidePanelStoryProps {
  detachable?: boolean;
  bubbleIcon?: ReactNode;
}

const SidePanelStory = (props: SidePanelStoryProps) => {
  const { detachable, bubbleIcon } = props;
  const [workbench] = useState(() => {
    const instance = createWorkbench({
      floatingPanels: detachable === false ? "hidden" : "visible",
      initialSidePanelMode: "closed",
    });
    instance.views.registerView({
      id: "side-panel.canvas",
      title: "Canvas",
      body: {
        kind: "react",
        render: () => <Text p="md">Open the Side Panel to edit the object name.</Text>,
      },
    });
    instance.views.registerView({
      id: "side-panel.inspector",
      title: "Inspector",
      body: {
        kind: "react",
        render: () => (
          <Stack p="md" gap="sm">
            <Text>Object name</Text>
            <Input aria-label="Object name" defaultValue="Clay Study" />
          </Stack>
        ),
      },
    });
    instance.shellPlacements.registerPlacement({
      id: "side-panel.canvas",
      item: { kind: "view", viewId: "side-panel.canvas", presence: "fixed" },
      region: "main",
    });
    instance.shellPlacements.registerPlacement({
      id: "side-panel.inspector",
      item: { kind: "view", viewId: "side-panel.inspector", presence: "fixed" },
      region: "side",
    });
    return instance;
  });
  return <WorkbenchStory workbench={workbench} sidePanelBubbleIcon={bubbleIcon} />;
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Side Panel",
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AttachedOnly: Story = {
  parameters: {
    docs: { description: { story: "An attached-only panel opens from the navigation bar and has no bubble." } },
  },
  render: () => <SidePanelStory detachable={false} />,
};

export const DefaultBubble: Story = {
  render: () => <SidePanelStory />,
};

export const CustomBubbleIcon: Story = {
  parameters: {
    docs: { description: { story: "Pass sidePanelBubbleIcon to Workbench to replace the default chat icon." } },
  },
  render: () => <SidePanelStory bubbleIcon={<SlidersHorizontal size={20} />} />,
};
