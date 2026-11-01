import { Flex, HStack, Popover, Portal, Spinner, Stack, Text } from "@chakra-ui/react";
import { SimpleCard } from "@pstdio/ui";
import { Button } from "../components/themed-primitives";

const warningStates = new Set(["Offline", "Downloading 42%", "Downloading", "Needs attention", "Sign in again"]);
const states = ["Sign in", "Signing in…", "Signed in", "Synced", "Syncing 3", "Syncing", "Local", ...warningStates];

interface CloudStatusProps {
  state: string;
  earlyAccess?: boolean;
  open?: boolean;
}

const CloudDetails = (props: CloudStatusProps) => {
  const { state, earlyAccess = true } = props;
  const connected = ["Synced", "Syncing 3", "Syncing", "Downloading 42%", "Downloading"].includes(state);
  const signedIn = !["Sign in", "Signing in…", "Sign in again"].includes(state);
  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Text textStyle="label/M/medium">Prompt Studio Cloud</Text>
        <Text textStyle="paragraph/S/regular" color={warningStates.has(state) ? "fg.warning" : "fg.muted"}>
          {earlyAccess ? state : "Cloud sync · Coming soon"}
        </Text>
      </Stack>
      {earlyAccess && connected && (
        <Stack gap="xs">
          <Text textStyle="label/S/medium" color="fg.muted">
            Devices
          </Text>
          <HStack justify="space-between">
            <Text>This Mac</Text>
            <Text color="fg.muted">This device</Text>
          </HStack>
          <HStack justify="space-between">
            <Text>Office Linux</Text>
            <Text color="fg.muted">Online</Text>
          </HStack>
        </Stack>
      )}
      <Stack gap="xs">
        <Text textStyle="label/S/medium" color="fg.muted">
          Account
        </Text>
        <Text textStyle="paragraph/S/regular">{signedIn ? "Alex Morgan" : "Not signed in"}</Text>
      </Stack>
      <Button size="sm" variant="display-link" asChild>
        <a href="#canvas-item=cloud-settings">Cloud settings</a>
      </Button>
    </Stack>
  );
};

const CloudStatus = (props: CloudStatusProps) => {
  const { state, earlyAccess = true, open = false } = props;
  const active = ["Signing in…", "Syncing 3", "Syncing", "Downloading 42%", "Downloading"].includes(state);
  return (
    <Popover.Root positioning={{ placement: "top-end" }} defaultOpen={open}>
      <Popover.Trigger asChild>
        <Button size="xs" variant="ghost-static" color={warningStates.has(state) ? "fg.warning" : "fg.muted"}>
          {active && <Spinner size="xs" />}
          {state}
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Body>
              <CloudDetails state={state} earlyAccess={earlyAccess} />
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

export const CloudStatusStates = () => (
  <Stack gap="sm" p="md">
    {states.map((state) => (
      <SimpleCard key={state}>
        <Flex align="center" justify="space-between" px="sm" py="xs">
          <Text textStyle="label/S/regular" color="fg.subtle">
            Workspace
          </Text>
          <CloudStatus state={state} />
        </Flex>
      </SimpleCard>
    ))}
  </Stack>
);

const CloudPopoverPreview = (props: CloudStatusProps) => {
  const { state, earlyAccess } = props;
  return (
    <Stack p="md" h="full" justify="flex-end" align="flex-end">
      <CloudStatus state={state} earlyAccess={earlyAccess} open />
    </Stack>
  );
};

export const CloudPopoverSynced = () => <CloudPopoverPreview state="Synced" />;
export const CloudPopoverOffline = () => <CloudPopoverPreview state="Offline" />;
export const CloudPopoverComingSoon = () => <CloudPopoverPreview state="Signed in" earlyAccess={false} />;
