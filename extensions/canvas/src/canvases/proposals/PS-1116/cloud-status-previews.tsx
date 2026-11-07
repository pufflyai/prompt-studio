import { Box, Flex, HStack, Popover, Portal, Spinner, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { AlertMessage, DeleteConfirmationModal, PopoverHeader, psTheme, SimpleCard } from "@pstdio/ui";
import { type ReactNode, useState } from "react";
import { Button } from "../../../components/themed-primitives";
import { CloudIcon, type CloudIconName } from "../../cloud-icon";

// PS-1116: three states for a device that returns after signing out or going offline.
export type ProposalState = "Signed out · 3 changed" | "Held for review" | "Synced · 2 replaced";

const warningStates = new Set(["Offline", "Held for review", "Synced · 2 replaced", "Sign in again"]);
const states = [
  "Synced",
  "Syncing 3",
  "Offline",
  "Local",
  "Signed out · 3 changed",
  "Held for review",
  "Synced · 2 replaced",
];

const statusColor = (state: string) => {
  if (state === "Synced") return "fg.success";
  return warningStates.has(state) ? "fg.warning" : "fg.muted";
};

const statusIcon = (state: string): CloudIconName => {
  if (state === "Offline") return "wifi-off";
  if (state === "Local" || state.startsWith("Signed out")) return "cloud-off";
  if (state === "Held for review" || state === "Synced · 2 replaced") return "triangle-alert";
  if (state === "Synced") return "circle-check";
  return "cloud";
};

const Row = (props: { label: string; detail: string }) => (
  <HStack justify="space-between" align="flex-start" gap="sm">
    <Text textStyle="paragraph/S/regular">{props.label}</Text>
    <Text textStyle="paragraph/S/regular" color="fg.muted" textAlign="end">
      {props.detail}
    </Text>
  </HStack>
);

const Section = (props: { title: string; children: ReactNode }) => (
  <Stack gap="xs">
    <Text textStyle="label/S/medium" color="fg.muted">
      {props.title}
    </Text>
    {props.children}
  </Stack>
);

const Devices = () => (
  <Section title="Devices">
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
  </Section>
);

const Account = (props: { signedIn: boolean }) => (
  <Section title="Account">
    <HStack gap="xs">
      <CloudIcon name="user-round" />
      <Text textStyle="paragraph/S/regular">{props.signedIn ? "Alex Morgan" : "Not signed in"}</Text>
    </HStack>
  </Section>
);

const SignedOutDetails = () => (
  <Stack gap="md">
    <Text textStyle="paragraph/S/regular" color="fg.muted">
      Sync is off on this device. Your changes stay here. When you sign in again, only the fields you changed are sent,
      and anything another device changed meanwhile keeps that device's version.
    </Text>
    <Section title="Changed on this device">
      <Row label="PS-1 Fix login redirect" detail="Title" />
      <Row label="PS-2 Add CSV export" detail="Assignee, status" />
      <Row label="PS-3 Rewrite onboarding copy" detail="Deleted" />
    </Section>
    <Account signedIn={false} />
    <Button size="sm" alignSelf="flex-start">
      <CloudIcon name="log-in" />
      Sign in
    </Button>
  </Stack>
);

const HeldDetails = () => {
  const [confirm, setConfirm] = useState<"apply" | "discard">();
  const [resolved, setResolved] = useState<string>();
  if (resolved)
    return (
      <Stack gap="md">
        <AlertMessage status="success" title={resolved} />
        <Devices />
      </Stack>
    );
  return (
    <Stack gap="md">
      <AlertMessage
        status="warning"
        title="Changes held for review"
        endElement={
          <HStack gap="xs">
            <Button size="xs" variant="outline" onClick={() => setConfirm("discard")}>
              Discard
            </Button>
            <Button size="xs" onClick={() => setConfirm("apply")}>
              Apply
            </Button>
          </HStack>
        }
      >
        This Mac came back with more changes than Cloud applies on its own. Nothing was uploaded, and your other devices
        keep syncing.
      </AlertMessage>
      <Section title="Held on this device">
        <Row label="3 tickets deleted" detail="PS-1, PS-2, PS-3" />
        <Row label="1 ticket changed" detail="PS-4 title" />
      </Section>
      <Account signedIn />
      <DeleteConfirmationModal
        open={confirm === "apply"}
        onClose={() => setConfirm(undefined)}
        headline="Apply the held changes?"
        buttonText="Apply changes"
        notificationText="3 tickets will be deleted on every device. Tickets another device changed while this Mac was away keep that device's version."
        onDelete={() => setResolved("Held changes applied")}
      />
      <DeleteConfirmationModal
        open={confirm === "discard"}
        onClose={() => setConfirm(undefined)}
        headline="Discard the held changes?"
        buttonText="Discard changes"
        notificationText="This Mac takes Cloud's copy of the project and starts syncing again. The held changes are removed from this Mac."
        onDelete={() => setResolved("Held changes discarded. This Mac matches Cloud.")}
      />
    </Stack>
  );
};

const ReplacedDetails = () => {
  const [dismissed, setDismissed] = useState(false);
  return (
    <Stack gap="md">
      {!dismissed && (
        <Section title="Replaced while this Mac was away">
          <Row label="PS-2 assignee" detail="Kept Dev from Office Linux (yours: Cara)" />
          <Row label="PS-5 rename" detail="Not applied: deleted on Office Linux" />
          <Button size="xs" variant="ghost" alignSelf="flex-start" onClick={() => setDismissed(true)}>
            <CloudIcon name="check" />
            Dismiss
          </Button>
        </Section>
      )}
      <Devices />
      <Account signedIn />
    </Stack>
  );
};

const SyncedDetails = () => (
  <Stack gap="md">
    <Devices />
    <Account signedIn />
  </Stack>
);

const details = (state: string) => {
  if (state.startsWith("Signed out")) return <SignedOutDetails />;
  if (state === "Held for review") return <HeldDetails />;
  if (state === "Synced · 2 replaced") return <ReplacedDetails />;
  return <SyncedDetails />;
};

const CloudStatus = (props: { state: string; open?: boolean }) => {
  const { state, open = false } = props;
  const styles = useSlotRecipe({ recipe: psTheme.getSlotRecipe("popover") })({ variant: "widget" });
  return (
    <Popover.Root positioning={{ placement: "top-end" }} defaultOpen={open} key={`${state}-${open}`}>
      <Popover.Trigger asChild>
        <Button size="xs" variant="ghost-static" color={statusColor(state)}>
          {state === "Syncing 3" ? <Spinner size="xs" /> : <CloudIcon name={statusIcon(state)} />}
          {state}
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content css={styles.content} maxW="360px">
            <PopoverHeader
              icon={<CloudIcon name="cloud" />}
              title={<Popover.Title>Prompt Studio Cloud</Popover.Title>}
            />
            <Popover.Body px="md" pb="sm">
              <Stack gap="md">
                <HStack gap="xs" color={statusColor(state)}>
                  <CloudIcon name={statusIcon(state)} />
                  <Text textStyle="paragraph/S/regular">{state}</Text>
                </HStack>
                {details(state)}
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

export const StatusStates = () => (
  <Stack gap="sm" p="md">
    {states.map((state) => (
      <SimpleCard key={state}>
        <Flex align="center" justify="space-between" px="sm" py="xs">
          <Text textStyle="label/S/regular" color="fg.subtle">
            {states.indexOf(state) > 3 ? "New" : "Existing"}
          </Text>
          <CloudStatus state={state} />
        </Flex>
      </SimpleCard>
    ))}
  </Stack>
);

export const ReturnPopover = (props: { state: ProposalState }) => (
  <Box p="md" h="full" minH="520px" display="flex" alignItems="flex-end" justifyContent="flex-end">
    <CloudStatus state={props.state} open />
  </Box>
);
