import { Flex, HStack, Popover, Portal, Spinner, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { PopoverHeader, psTheme, SimpleCard } from "@pstdio/ui";
import { Button } from "../components/themed-primitives";
import { CloudIcon, type CloudIconName } from "./cloud-icon";

const warningStates = new Set(["Offline", "Downloading 42%", "Downloading", "Needs attention", "Sign in again"]);
const states = ["Sign in", "Signing in…", "Signed in", "Synced", "Syncing 3", "Syncing", "Local", ...warningStates];

const statusColor = (state: string) => {
  if (state === "Synced") return "fg.success";
  return warningStates.has(state) ? "fg.warning" : "fg.muted";
};

const statusIcon = (state: string): CloudIconName => {
  if (state === "Offline") return "wifi-off";
  if (state === "Local") return "cloud-off";
  if (state === "Sign in" || state === "Sign in again") return "user-round-key";
  if (state === "Needs attention") return "triangle-alert";
  if (state === "Synced") return "circle-check";
  return "cloud";
};

interface CloudStatusProps {
  state: string;
  earlyAccess?: boolean;
  open?: boolean;
}

const CloudDetails = (props: CloudStatusProps) => {
  const { state, earlyAccess = true } = props;
  const connected = ["Synced", "Syncing 3", "Syncing", "Downloading 42%", "Downloading"].includes(state);
  const signedIn = !["Sign in", "Signing in…", "Sign in again"].includes(state);
  let settingsPreview = "CloudSettingsConnected";
  if (!earlyAccess) settingsPreview = "CloudSettingsComingSoon";
  else if (state === "Local") settingsPreview = "CloudSettingsLocal";
  return (
    <Stack gap="md">
      <HStack gap="xs" color={statusColor(state)}>
        <CloudIcon name={statusIcon(state)} />
        <Text textStyle="paragraph/S/regular">{earlyAccess ? state : "Cloud sync · Coming soon"}</Text>
      </HStack>
      {earlyAccess && connected && (
        <Stack gap="xs">
          <Text textStyle="label/S/medium" color="fg.muted">
            Devices
          </Text>
          <HStack justify="space-between">
            <HStack gap="xs">
              <CloudIcon name="laptop" />
              <Text>This Mac</Text>
            </HStack>
            <Text color="fg.muted">This device</Text>
          </HStack>
          <HStack justify="space-between">
            <HStack gap="xs">
              <CloudIcon name="monitor" />
              <Text>Office Linux</Text>
            </HStack>
            <Text color="fg.muted">Online</Text>
          </HStack>
        </Stack>
      )}
      <Stack gap="xs">
        <Text textStyle="label/S/medium" color="fg.muted">
          Account
        </Text>
        <HStack gap="xs">
          <CloudIcon name="user-round" />
          <Text textStyle="paragraph/S/regular">{signedIn ? "Alex Morgan" : "Not signed in"}</Text>
        </HStack>
      </Stack>
      <Button size="sm" variant="outline" alignSelf="flex-start" asChild>
        <a href={`#canvas-item=${settingsPreview}`}>
          <CloudIcon name="settings" />
          Cloud settings
        </a>
      </Button>
    </Stack>
  );
};

const CloudStatus = (props: CloudStatusProps) => {
  const { state, earlyAccess = true, open = false } = props;
  const active = ["Signing in…", "Syncing 3", "Syncing", "Downloading 42%", "Downloading"].includes(state);
  const styles = useSlotRecipe({ recipe: psTheme.getSlotRecipe("popover") })({ variant: "widget" });
  return (
    <Popover.Root positioning={{ placement: "top-end" }} defaultOpen={open}>
      <Popover.Trigger asChild>
        <Button size="xs" variant="ghost-static" color={statusColor(state)}>
          {active ? <Spinner size="xs" /> : <CloudIcon name={statusIcon(state)} />}
          {state}
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content css={styles.content}>
            <PopoverHeader
              icon={<CloudIcon name="cloud" />}
              title={<Popover.Title>Prompt Studio Cloud</Popover.Title>}
            />
            <Popover.Body px="md" pb="sm">
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
