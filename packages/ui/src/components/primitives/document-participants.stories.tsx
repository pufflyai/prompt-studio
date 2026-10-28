import { Box, Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { type DocumentParticipant, DocumentParticipants } from "./document-participants";

const participants: DocumentParticipant[] = [
  { id: "alex-laptop-tab", label: "Alex", color: "blue" },
  { id: "sam-desktop-tab", label: "Sam", color: "purple" },
];
const meta = { title: "Primitives/DocumentParticipants", component: DocumentParticipants } satisfies Meta<
  typeof DocumentParticipants
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = { args: { participants, label: "Other editors" } };
export const Offline: Story = { args: { participants: [], label: "Other editors" } };
export const Narrow: Story = {
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
  render: () => <LeavingParticipant />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("listitem", { name: "Alex" })).toBeVisible();
    await expect(canvas.getByRole("listitem", { name: "Sam" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Disconnect" }));
    await expect(canvas.queryByRole("list", { name: "Other editors" })).not.toBeInTheDocument();
  },
};
