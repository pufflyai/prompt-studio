import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";

import { type DocumentParticipant, DocumentParticipants } from "./document-participants";

const participants: DocumentParticipant[] = [
  { id: "alex-laptop-tab", label: "Alex", color: "blue" },
  { id: "sam-desktop-tab", label: "Sam", color: "purple" },
];
const meta = {
  title: "Design system/Components/Data display/Document participants",
  component: DocumentParticipants,
} satisfies CanvasMeta<typeof DocumentParticipants>;
export default {
  title: "Design system/Components/Data display/Document participants",
  fullscreen: true,
};
type Story = CanvasFrame<typeof meta>;

const Connected: Story = {
  id: "primitives-document-participants--connected",
  args: { participants, label: "Other editors" },
};
const Offline: Story = {
  id: "primitives-document-participants--offline",
  args: { participants: [], label: "Other editors" },
};
const Narrow: Story = {
  id: "primitives-document-participants--narrow",
  args: {
    participants: Array.from({ length: 12 }, (_, index) => ({
      ...participants[index % participants.length],
      id: `editor-${index}`,
      label: `Long participant name ${index + 1}`,
    })),
    label: "Other editors",
  },
  render: (args) => (
    <Box maxW="3xs">
      <DocumentParticipants {...args} />
    </Box>
  ),
};

const LeavingParticipant = () => {
  const [visible, setVisible] = useState(participants);
  return (
    <Stack gap="md">
      <DocumentParticipants participants={visible} label="Other editors" />
      <Button size="xs" onClick={() => setVisible([])}>
        Disconnect
      </Button>
    </Stack>
  );
};
const Leave: Story = {
  id: "primitives-document-participants--leave",
  render: () => <LeavingParticipant />,
};

const Examples = createCanvasExampleNavigator(meta, { Connected, Offline, Narrow, Leave });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Connected };
