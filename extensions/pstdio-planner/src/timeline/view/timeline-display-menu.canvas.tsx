import { Button, Flex, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useCollectionViewStore } from "@pstdio/ui/collection-view";
import { useState } from "react";
import { TimelineDisplayMenu } from "./timeline-display-menu";
import { TimelinePresentationProvider } from "./timeline-presentation";
import { timelineInitialState } from "./timeline-query";

const meta: CanvasMeta<typeof TimelineDisplayMenu> = {
  title: "Extensions/Planner/Timeline display",
  component: TimelineDisplayMenu,
  decorators: [
    (Story) => (
      <TimelinePresentationProvider projectId="timeline-display-story">
        <Story />
      </TimelinePresentationProvider>
    ),
  ],
  args: {
    storageKey: "timeline-display-story",
    attributes: [
      { id: "id", label: "ID", type: { kind: "string" }, displayable: true },
      { id: "status", label: "Status", type: { kind: "enum", options: [] }, displayable: true },
      { id: "needsAttention", label: "Needs attention", type: { kind: "enum", options: [] }, displayable: true },
      { id: "priority", label: "Priority", type: { kind: "enum", options: [] }, displayable: true },
      { id: "type", label: "Type", type: { kind: "enum", options: [] }, displayable: true },
      { id: "track", label: "Track", type: { kind: "enum", options: [] }, displayable: true },
    ],
  },
};
export default meta;
type Story = CanvasFrame<typeof TimelineDisplayMenu>;
export const Properties: Story = {
  id: "extensions-planner-timeline-display--properties",
};

export const SaveDisplay = () => {
  const { settings } = useCollectionViewStore("timeline-display-close", timelineInitialState, (state) => state);
  const [saved, setSaved] = useState("");
  return (
    <Stack h="600px" p="md">
      <Flex justify="end">
        <TimelineDisplayMenu
          storageKey="timeline-display-close"
          attributes={[{ id: "id", label: "ID", type: { kind: "string" }, displayable: true }]}
        />
      </Flex>
      <Flex justify="end">
        <Button onClick={() => setSaved(JSON.stringify(settings.displayProperties))}>Save view</Button>
      </Flex>
      <output aria-label="Saved display properties">{saved}</output>
    </Stack>
  );
};
