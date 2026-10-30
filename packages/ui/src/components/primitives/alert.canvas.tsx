import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { AlertMessage } from "./alert";

const meta = {
  title: "Primitives/AlertMessage",
  component: AlertMessage,
  description:
    "Titles and descriptions wrap and scroll within the alert. Alerts use at most half the viewport, capped at 24rem, and shrink inside constrained flex layouts. Error alerts include Copy error message, which copies the complete title and message. Extension webviews need clipboard.write. Place recovery controls in endElement for a wrapping bottom-right footer outside the scrolling content. Dismiss buttons stay at the top right, aligned with the icon and the first title line. Both use compact ghost buttons with hover, focus, and pressed backgrounds tinted by the alert's semantic color.",
} satisfies CanvasMeta<typeof AlertMessage>;
export default meta;
type Story = CanvasVariant<typeof AlertMessage>;
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
  id: "primitives-alertmessage--actions",
  render: () => <AlertActionsPreview />,
};
export const Statuses: Story = {
  id: "primitives-alertmessage--statuses",
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
  id: "primitives-alertmessage--narrow-actions",
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
};
export const WarningActions: Story = {
  id: "primitives-alertmessage--warning-actions",
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
  id: "primitives-alertmessage--recoverable",
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
  id: "primitives-alertmessage--long-content",
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
export const VariableContent: Story = {
  id: "primitives-alertmessage--variable-content",
  render: () => <VariableContentPreview />,
};
export const VariableTitle: Story = {
  id: "primitives-alertmessage--variable-title",
  render: () => <VariableContentPreview titleOnly />,
};
export const ConstrainedContent: Story = {
  id: "primitives-alertmessage--constrained-content",
  render: () => <VariableContentPreview constrained />,
};
export const CopyMessage: Story = {
  id: "primitives-alertmessage--copy-message",
  render: () => <VariableContentPreview />,
};
