import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";

import { type DocumentParticipant, DocumentParticipants } from "./document-participants";

const participants: DocumentParticipant[] = [
  { id: "alex-laptop-tab", label: "Alex", color: "blue" },
  { id: "sam-desktop-tab", label: "Sam", color: "purple" },
];
const meta = { title: "Primitives/DocumentParticipants", component: DocumentParticipants } satisfies CanvasMeta<
  typeof DocumentParticipants
>;
export default meta;
type Story = CanvasVariant<typeof meta>;

export const Connected: Story = {
  id: "primitives-document-participants--connected",
  args: { participants, label: "Other editors" },
};
export const Offline: Story = {
  id: "primitives-document-participants--offline",
  args: { participants: [], label: "Other editors" },
};
export const Narrow: Story = {
  id: "primitives-document-participants--narrow",
  args: { participants, label: "Other editors" },
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
export const Leave: Story = {
  id: "primitives-document-participants--leave",
  render: () => <LeavingParticipant />,
};
