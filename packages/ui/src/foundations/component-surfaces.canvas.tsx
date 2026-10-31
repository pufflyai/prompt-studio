import { Badge, Button, Dialog, Flex, Kbd, Popover, Portal, Stack, Tabs, Text } from "@chakra-ui/react";
import { useState } from "react";
import { ListRow } from "@/components/list-row/list-row";
import {
  AlertMessage,
  Chip,
  EmptyState,
  SessionIndicator,
  SimpleCard,
  SimpleCardBody,
  Tooltip,
} from "@/components/primitives";

export default { title: "Design System/Component surfaces" };

export const FeedbackStates = () => (
  <Stack p="md" gap="md">
    <Text textStyle="heading/M">Feedback &amp; status</Text>
    <AlertMessage status="info" title="Ready to explore">
      All examples use sample data.
    </AlertMessage>
    <AlertMessage status="success" title="Changes saved">
      The design is ready to compare.
    </AlertMessage>
    <AlertMessage status="warning" title="Review before continuing">
      Check the layout at smaller widths.
    </AlertMessage>
    <AlertMessage status="error" title="Preview error" endElement={<Button>Try again</Button>}>
      This is a sample error state.
    </AlertMessage>
  </Stack>
);

export const BadgeStates = () => (
  <Stack p="md" gap="md">
    <Text textStyle="heading/M">Badges &amp; identity</Text>
    <Flex gap="sm" wrap="wrap">
      <Chip>Feature</Chip>
      <Chip>UI</Chip>
      <Badge variant="ticket">Ticket tag</Badge>
      <Badge colorPalette="green">Done</Badge>
      <Badge colorPalette="orange">Needs review</Badge>
      <Badge colorPalette="red">Failed</Badge>
    </Flex>
    {(["in_progress", "awaiting_input", "queued", "completed", "failed", "cancelled", "disconnected"] as const).map(
      (status) => (
        <Flex gap="xs" align="center" key={status}>
          <SessionIndicator status={status} ariaLabel={status} />
          <Text textStyle="label/S/medium">{status}</Text>
        </Flex>
      ),
    )}
  </Stack>
);

export const SurfaceStates = () => {
  const [selected, setSelected] = useState("overview");
  return (
    <Stack p="md" gap="md">
      <Text textStyle="heading/M">Layout &amp; navigation</Text>
      <SimpleCard>
        <SimpleCardBody>
          <Stack gap="sm">
            <Text textStyle="heading/S">Project overview</Text>
            <Text textStyle="paragraph/S/regular">A shared card with sample content.</Text>
          </Stack>
        </SimpleCardBody>
      </SimpleCard>
      <Tabs.Root defaultValue="overview" size="sm">
        <Tabs.List>
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
          <Tabs.Trigger value="disabled" disabled>
            Disabled
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="overview">
          <Text textStyle="paragraph/S/regular">Overview content</Text>
        </Tabs.Content>
        <Tabs.Content value="activity">
          <Text textStyle="paragraph/S/regular">Activity content</Text>
        </Tabs.Content>
      </Tabs.Root>
      <Stack gap="none">
        {["overview", "files", "settings"].map((id) => (
          <ListRow key={id} label={id} isSelected={selected === id} onActivate={() => setSelected(id)} />
        ))}
      </Stack>
    </Stack>
  );
};

export const EmptyStates = () => (
  <EmptyState title="No designs yet" description="Start a new design to compare ideas.">
    <Button variant="primary">Create design</Button>
  </EmptyState>
);
export const KeyboardStates = () => (
  <Stack p="md" gap="md">
    <Text textStyle="heading/M">Keyboard shortcuts</Text>
    <Flex gap="xs" align="center">
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
      <Text textStyle="label/S/medium">Open command palette</Text>
    </Flex>
    <Flex gap="xs" align="center">
      <Kbd>Shift</Kbd>
      <Kbd>↵</Kbd>
      <Text textStyle="label/S/medium">New line</Text>
    </Flex>
    <Flex gap="xs" align="center">
      <Kbd variant="subtle">Esc</Kbd>
      <Kbd variant="outline">Tab</Kbd>
      <Kbd variant="raised">Enter</Kbd>
    </Flex>
  </Stack>
);
export const OverlayStates = () => (
  <Stack p="md" gap="md">
    <Text textStyle="heading/M">Overlays</Text>
    <Tooltip content="Helpful details" openDelay={300}>
      <Button>Show tooltip</Button>
    </Tooltip>
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button>Open popover</Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Body>Popover content stays at screen size.</Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button>Open dialog</Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Example dialog</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>Dialog content stays at screen size.</Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button>Close</Button>
              </Dialog.ActionTrigger>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  </Stack>
);
