import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { AlertMessage } from "./alert";

const meta = {
  title: "Primitives/AlertMessage",
  component: AlertMessage,
  tags: ["alerts"],
  parameters: {
    docs: {
      description: {
        component:
          "Titles and descriptions wrap and scroll within the alert. Alerts use at most half the viewport, capped at 24rem, and shrink inside constrained flex layouts. Error alerts include Copy error message, which copies the complete title and message. Extension webviews need clipboard.write. Place recovery controls in endElement for a wrapping bottom-right footer outside the scrolling content. Dismiss buttons stay at the top right, aligned with the icon and the first title line. Both use compact ghost buttons with hover, focus, and pressed backgrounds tinted by the alert's semantic color.",
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

export const WarningActions: Story = {
  render: () => (
    <AlertMessage status="warning" title="No connection available">
      <Stack gap="xs">
        <Text>Review the connection settings, then check again.</Text>
        <Flex gap="xs" wrap="wrap">
          <Button variant="outline">Review settings</Button>
          <Button variant="outline">Check again</Button>
        </Flex>
      </Stack>
    </AlertMessage>
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

const VariableContentPreview = (props: { titleOnly?: boolean; constrained?: boolean }) => {
  const { titleOnly = false, constrained = false } = props;
  const [requested, setRequested] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const details = Array.from({ length: 100 }, (_, index) => `Diagnostic ${index}: /${"resource-path".repeat(10)}`).join(
    "\n",
  );
  return (
    <Stack width="sm" maxW="full" height={constrained ? "48" : undefined} minH="0">
      {dismissed ? (
        <>
          <Text>Dismissed</Text>
          <Button
            onClick={() => {
              setDismissed(false);
              setRequested(false);
            }}
          >
            Reset alert
          </Button>
        </>
      ) : (
        <AlertMessage
          status="error"
          role="alert"
          title={titleOnly ? details : "Service unavailable"}
          onClose={() => setDismissed(true)}
          endElement={<Button onClick={() => setRequested(true)}>{requested ? "Requested" : "Retry"}</Button>}
        >
          {titleOnly ? null : (
            <Box as="pre">
              {details}
              {requested ? "\nRetry requested" : ""}
            </Box>
          )}
        </AlertMessage>
      )}
    </Stack>
  );
};

const checkVariableContent: Story["play"] = async ({ canvas, canvasElement }) => {
  const alert = canvas.getByRole("alert");
  const bounds = alert.getBoundingClientRect();
  const window = canvasElement.ownerDocument.defaultView!;
  await expect(bounds.height).toBeLessThanOrEqual(window.innerHeight / 2);
  await expect(alert.scrollWidth).toBeLessThanOrEqual(alert.clientWidth);
  const viewport = alert.querySelector<HTMLElement>('[data-scope="scroll-area"][data-part="viewport"]')!;
  await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
  viewport.scrollTop = viewport.scrollHeight;
  await expect(viewport.scrollTop).toBeGreaterThan(0);
  const scrollbar = alert.querySelector<HTMLElement>('[data-part="scrollbar"][data-orientation="vertical"]')!;
  const thumb = scrollbar.querySelector<HTMLElement>('[data-part="thumb"]')!;
  const alertStyle = window.getComputedStyle(alert);
  await expect(window.getComputedStyle(thumb).backgroundColor).toBe(alertStyle.color);
  await expect(
    Math.abs(scrollbar.getBoundingClientRect().right - bounds.right + Number.parseFloat(alertStyle.paddingRight)),
  ).toBeLessThan(1);
  await userEvent.hover(scrollbar);
  await expect(window.getComputedStyle(thumb).backgroundColor).toBe(alertStyle.color);
  await userEvent.unhover(scrollbar);
  const retry = canvas.getByRole("button", { name: "Retry" });
  await expect(retry.getBoundingClientRect().bottom).toBeLessThanOrEqual(bounds.bottom);
  await userEvent.click(retry);
  await expect(canvas.getByRole("button", { name: "Requested" })).toBeVisible();
  await userEvent.click(canvas.getByRole("button", { name: "Dismiss" }));
  await expect(canvas.getByText("Dismissed")).toBeVisible();
  await userEvent.click(canvas.getByRole("button", { name: "Reset alert" }));
};

export const VariableContent: Story = {
  render: () => <VariableContentPreview />,
  play: checkVariableContent,
};

export const VariableTitle: Story = {
  render: () => <VariableContentPreview titleOnly />,
  play: checkVariableContent,
};

export const ConstrainedContent: Story = {
  render: () => <VariableContentPreview constrained />,
  play: async (context) => {
    const alert = context.canvas.getByRole("alert");
    await expect(alert.getBoundingClientRect().height).toBeLessThanOrEqual(
      alert.parentElement!.getBoundingClientRect().height,
    );
    await checkVariableContent!(context);
  },
};

export const CopyMessage: Story = {
  render: () => <VariableContentPreview />,
  play: async ({ canvas }) => {
    const user = userEvent.setup();
    await user.click(canvas.getByRole("button", { name: "Copy error message" }));
    const copied = await navigator.clipboard.readText();
    await expect(copied).toContain("Service unavailable");
    await expect(copied).toContain("Diagnostic 99");
    await expect(copied).not.toContain("Copy error message");
    await expect(copied).not.toContain("Retry");
    await user.click(canvas.getByRole("button", { name: "Retry" }));
    await user.click(canvas.getByRole("button", { name: "Copied" }));
    await expect(await navigator.clipboard.readText()).toContain("Retry requested");
  },
};
