import { Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { AlertMessage } from "./alert";

const meta = {
  title: "Primitives/AlertMessage",
  component: AlertMessage,
} satisfies Meta<typeof AlertMessage>;
export default meta;
type Story = StoryObj<typeof AlertMessage>;

export const Statuses: Story = {
  render: () => (
    <Stack gap="sm">
      <AlertMessage status="info" title="Pipeline saved" />
      <AlertMessage status="success" title="Workspace ready">
        Everything is configured and ready to go.
      </AlertMessage>
      <AlertMessage status="warning" title="Merge conflicts detected" />
      <AlertMessage status="error" title="Hook failed" />
    </Stack>
  ),
};

// Banners the user cannot act on are not shown. Every shown banner offers a way to recover and can be closed.
export const Recoverable: Story = {
  render: () => (
    <Stack gap="sm">
      <AlertMessage
        layout="banner"
        status="error"
        title="Could not load conversation"
        onClose={() => {}}
        endElement={
          <Button size="2xs" variant="outline">
            Retry
          </Button>
        }
      >
        The connection to the session was lost.
      </AlertMessage>
      <AlertMessage
        layout="banner"
        status="warning"
        title="Could not update queued prompts"
        onClose={() => {}}
        endElement={
          <Button size="2xs" variant="outline">
            Retry
          </Button>
        }
      />
    </Stack>
  ),
};
