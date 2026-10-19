import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { AlertMessage } from "./alert";

const meta = {
  title: "Primitives/AlertMessage",
  component: AlertMessage,
  parameters: {
    docs: {
      description: {
        component:
          "Place recovery controls in endElement for a wrapping bottom-right footer. Dismiss buttons stay at the top right, aligned with the icon and the first title line. Both use compact ghost buttons with hover, focus, and pressed backgrounds tinted by the alert's semantic color.",
      },
    },
  },
} satisfies Meta<typeof AlertMessage>;
export default meta;
type Story = StoryObj<typeof AlertMessage>;

const examples = [
  {
    status: "info",
    title: "Connection restored",
    message: "Your workspace is connected again.",
    action: "View connection",
  },
  { status: "success", title: "Workspace ready", message: "Extensions loaded successfully.", action: "Open workspace" },
  {
    status: "warning",
    title: "Indexing paused",
    message: "Search may be incomplete until indexing resumes.",
    action: "Resume indexing",
  },
  {
    status: "error",
    title: "Extension runtime stopped",
    message: "The process ended unexpectedly. Restart it to recover.",
    action: "Restart service",
  },
] as const;

const AlertActionsPreview = () => {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [requested, setRequested] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  return (
    <Stack gap="sm" width="lg" maxW="full">
      <Button
        alignSelf="flex-start"
        size="xs"
        onClick={() => {
          setDismissed([]);
          setRequested([]);
          setExpanded([]);
        }}
      >
        Reset alerts
      </Button>
      {examples
        .filter((example) => !dismissed.includes(example.status))
        .map((example) => (
          <AlertMessage
            key={example.status}
            role="alert"
            status={example.status}
            title={example.title}
            closeLabel={`Dismiss ${example.status} notice`}
            onClose={() => setDismissed([...dismissed, example.status])}
            endElement={
              <>
                <Button onClick={() => setRequested([...requested, example.status])}>{example.action}</Button>
                <Button onClick={() => setExpanded([...expanded, example.status])}>Show details</Button>
              </>
            }
          >
            <Stack gap="2xs">
              <Text>{example.message}</Text>
              {requested.includes(example.status) && <Text>Action requested</Text>}
              {expanded.includes(example.status) && <Text>Your work is saved. You can keep using the workspace.</Text>}
            </Stack>
          </AlertMessage>
        ))}
    </Stack>
  );
};

export const Actions: Story = {
  render: () => <AlertActionsPreview />,
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("alert")).toHaveLength(4);
    const error = within(canvas.getAllByRole("alert")[3]);
    const dismiss = error.getByRole("button", { name: "Dismiss error notice" }).getBoundingClientRect();
    const title = error.getByText("Extension runtime stopped").getBoundingClientRect();
    const indicator = canvas.getAllByRole("alert")[3].firstElementChild!.getBoundingClientRect();
    const action = error.getByRole("button", { name: "Restart service" }).getBoundingClientRect();
    const center = (rect: DOMRect) => rect.top + rect.height / 2;
    await expect(Math.abs(center(dismiss) - center(title))).toBeLessThanOrEqual(1);
    await expect(Math.abs(center(indicator) - center(title))).toBeLessThanOrEqual(1);
    await expect(title.left - indicator.right).toBeGreaterThanOrEqual(8);
    await expect(dismiss.bottom).toBeLessThanOrEqual(action.top);
    await userEvent.click(error.getByRole("button", { name: "Restart service" }));
    await expect(error.getByText("Action requested")).toBeVisible();
    await userEvent.click(error.getByRole("button", { name: "Show details" }));
    await expect(error.getByText("Your work is saved. You can keep using the workspace.")).toBeVisible();
    await userEvent.click(error.getByRole("button", { name: "Dismiss error notice" }));
    await expect(canvas.getAllByRole("alert")).toHaveLength(3);
    await userEvent.click(canvas.getByRole("button", { name: "Reset alerts" }));
    await expect(canvas.getAllByRole("alert")).toHaveLength(4);
  },
};

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

export const NarrowActions: Story = {
  render: () => (
    <Box width="2xs" maxW="full">
      <AlertMessage
        role="alert"
        status="error"
        title="Extension runtime stopped"
        onClose={() => {}}
        endElement={
          <>
            <Button>Restart service</Button>
            <Button>Show diagnostic details</Button>
          </>
        }
      >
        The process ended unexpectedly. Your work is saved.
      </AlertMessage>
    </Box>
  ),
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert.scrollWidth).toBeLessThanOrEqual(alert.clientWidth);
  },
};

// A problem the user can act on can be closed; only a temporary failure offers Retry.
export const Recoverable: Story = {
  render: () => (
    <Stack gap="sm">
      <AlertMessage
        status="error"
        title="Could not load conversation"
        onClose={() => {}}
        endElement={<Button>Retry</Button>}
      >
        The server had a temporary problem.
      </AlertMessage>
      <AlertMessage status="error" title="Could not load conversation" onClose={() => {}}>
        This session no longer exists.
      </AlertMessage>
    </Stack>
  ),
};

export const LongContent: Story = {
  render: () => (
    <Box width="sm" maxW="full">
      <AlertMessage
        status="error"
        role="alert"
        title={`Service unavailable: ${"long-service-name".repeat(12)}`}
        onClose={() => {}}
        endElement={<Button>{`Restart ${"unbroken-service-name".repeat(8)}`}</Button>}
      >
        {`Unable to load /${"unbroken-resource-path".repeat(30)}.`}
      </AlertMessage>
    </Box>
  ),
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert.scrollWidth).toBeLessThanOrEqual(alert.clientWidth);
  },
};
