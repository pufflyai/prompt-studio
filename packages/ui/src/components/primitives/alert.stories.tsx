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

// A problem the user can act on can be closed; only a temporary failure offers Retry.
export const Recoverable: Story = {
  render: () => (
    <Stack gap="sm">
      <AlertMessage
        status="error"
        title="Could not load conversation"
        onClose={() => {}}
        endElement={
          <Button size="2xs" variant="outline">
            Retry
          </Button>
        }
      >
        The server had a temporary problem.
      </AlertMessage>
      <AlertMessage status="error" title="Could not load conversation" onClose={() => {}}>
        This session no longer exists.
      </AlertMessage>
    </Stack>
  ),
};
