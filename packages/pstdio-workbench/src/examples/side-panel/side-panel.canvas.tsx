import { Input, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { SlidersHorizontal } from "lucide-react";
import { type ReactNode, useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../workbench-story";

interface SidePanelStoryProps {
  detachable?: boolean;
  empty?: boolean;
  bubbleIcon?: ReactNode;
}
const SidePanelStory = (props: SidePanelStoryProps) => {
  const { detachable, bubbleIcon, empty } = props;
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
      item: {
        kind: "view",
        presence: "fixed",
        view: {
          kind: "view",
          id: "side-panel.canvas",
        },
      },
      region: "main",
    });
    if (!empty)
      instance.shellPlacements.registerPlacement({
        id: "side-panel.inspector",
        item: {
          kind: "view",
          presence: "fixed",
          view: {
            kind: "view",
            id: "side-panel.inspector",
          },
        },
        region: "side",
      });
    return instance;
  });
  return <WorkbenchStory workbench={workbench} sidePanelBubbleIcon={bubbleIcon} />;
};
const meta = {
  title: "Product/Reference/Core API/Side panel",
  fullscreen: true,
} satisfies CanvasMeta;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const AttachedOnly: Story = {
  id: "pstdio-workbench-reference-core-api-side-panel--attached-only",
  description: "An attached-only panel opens from the navigation bar and has no bubble.",
  render: () => <SidePanelStory detachable={false} />,
};
export const DefaultBubble: Story = {
  id: "pstdio-workbench-reference-core-api-side-panel--default-bubble",
  description:
    "Drag the bubble between left, center, and right using borderless circular placeholders matching its exact size and resting positions. All drag targets share the floating-panel indicator palette. Floating-panel snap markers sit at the bottom left, center and right, using the same 12px inset as the panel’s bottom spacing. The floating header context menu and Appearance settings choose Snap to alignment or Move freely. Snap mode shares the bubble alignment; free mode moves in both directions. Small corner highlights resize from top-left when aligned right, top-right when aligned left, and either top corner when centered. Snap resizing keeps the chosen horizontal anchor stable; free resizing keeps the opposite corner fixed. Size and free position survive close and reload. Choose the default panel and bubble visibility in Appearance. Alt+Shift+Left/Right changes alignment.",
  render: () => <SidePanelStory />,
};
export const CustomBubbleIcon: Story = {
  id: "pstdio-workbench-reference-core-api-side-panel--custom-bubble-icon",
  description: "Pass sidePanelBubbleIcon to Workbench to replace the default chat icon.",
  render: () => <SidePanelStory bubbleIcon={<SlidersHorizontal size={20} />} />,
};

export const EmptyShell: Story = {
  id: "pstdio-workbench-reference-core-api-side-panel--empty-shell",
  description: "The generic Side Panel can open and attach before any provider places content in it.",
  render: () => <SidePanelStory empty />,
};
