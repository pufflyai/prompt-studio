import { Box, Button, HStack, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Check, CircleDashed } from "lucide-react";
import { useState } from "react";
import { KanbanRendererBoard } from "@/components/kanban-renderer/kanban-renderer-board";
import { SessionIndicator } from "@/components/primitives/session-indicator";

const AgentDemo = () => {
  const story = useSlotRecipe({ key: "landingStory" })({});
  const styles = useSlotRecipe({ key: "landingToolDemo" })({});
  const [completed, setCompleted] = useState(false);
  const task = {
    id: "TOOL-16",
    cardProps: {
      eyebrow: "TOOL-16",
      title: "Use the icon set in the shader preview",
      customSlots: [
        <HStack key="session" css={styles.sessionStatus} data-status={completed ? "completed" : "in_progress"}>
          <SessionIndicator status={completed ? "completed" : "in_progress"} boxSize="icon-sm" />
          <Text textStyle="label/XS/regular">Codex · Build</Text>
        </HStack>,
      ],
    },
  };
  const columns = [
    { id: "running", label: "In progress", color: "blue", items: completed ? [] : [task] },
    { id: "review", label: "Ready for review", color: "green", items: completed ? [task] : [] },
  ].map((column) => ({ ...column, canDragIn: false, canDragOut: false, canCreate: false, actions: [] }));
  return (
    <Box css={story.page}>
      <Box css={story.visual}>
        <Box css={story.panel}>
          <Box css={story.panelHeader}>Tool development</Box>
          <Box height="80">
            <KanbanRendererBoard columns={columns} />
          </Box>
        </Box>
      </Box>
      <Box css={story.panels}>
        <Box css={story.panel}>
          <Box css={story.panelHeader}>Agent sessions</Box>
          <Box css={story.panelBody}>
            <Text textStyle="label/M/medium">Use the icon set in the shader preview</Text>
            <Button variant="subtle" onClick={() => setCompleted(!completed)}>
              {completed ? "Start session" : "Complete session"}
            </Button>
          </Box>
        </Box>
        <Box css={story.panel}>
          <Box css={story.panelHeader}>When a session completes</Box>
          <Stack css={story.panelBody}>
            <Text textStyle="mono/XS">session.completed</Text>
            <HStack gap="sm">
              {completed ? <Check size={16} /> : <CircleDashed size={16} />}
              <Text>Move task to Ready for review</Text>
            </HStack>
            <HStack gap="sm">
              {completed ? <Check size={16} /> : <CircleDashed size={16} />}
              <Text>Start a review session</Text>
            </HStack>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};
const meta = {
  title: "Theme/Landing Agent Demo",
  component: AgentDemo,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AgentDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = {};
export const NarrowPanel: Story = {
  decorators: [
    (Story) => (
      <Box width="80">
        <Story />
      </Box>
    ),
  ],
};
