import { HStack, Input, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, DeleteConfirmationModal, ScrollArea, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "../components/themed-primitives";

interface DeviceRowProps {
  name: string;
  current: boolean;
  onRemove: () => void;
}

const DeviceRow = (props: DeviceRowProps) => {
  const { name, current, onRemove } = props;
  const [label, setLabel] = useState(name);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  return (
    <HStack gap="sm" justify="space-between">
      <Stack gap="2xs" flex="1" minW="0">
        {renaming ? (
          <Input size="sm" aria-label="Device name" value={draft} onChange={(event) => setDraft(event.target.value)} />
        ) : (
          <Text>{label}</Text>
        )}
        <Text textStyle="label/S/regular" color="fg.muted">
          {current ? "This device" : "Online"}
        </Text>
      </Stack>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          if (renaming && draft.trim()) setLabel(draft.trim());
          setRenaming(!renaming);
        }}
      >
        {renaming ? "Save" : "Rename"}
      </Button>
      <Button size="sm" variant="destructive-ghost" onClick={onRemove}>
        Remove
      </Button>
    </HStack>
  );
};

interface CloudSettingsProps {
  earlyAccess?: boolean;
  initialLocal?: boolean;
  confirmInitiallyOpen?: boolean;
}

const CloudSettings = (props: CloudSettingsProps) => {
  const { earlyAccess = true, initialLocal = false, confirmInitiallyOpen = false } = props;
  const [local, setLocal] = useState(initialLocal);
  const [signedIn, setSignedIn] = useState(true);
  const [confirming, setConfirming] = useState(confirmInitiallyOpen);
  const [devices, setDevices] = useState(["This Mac", "Office Linux"]);
  return (
    <ScrollArea h="full">
      <Stack gap="md" p="lg">
        <Text textStyle="heading/S">Cloud</Text>
        <SimpleCard>
          <SimpleCardBody>
            <Stack gap="sm">
              <Text textStyle="label/M/medium">Account</Text>
              <HStack justify="space-between">
                <Stack gap="2xs">
                  <Text>{signedIn ? "Alex Morgan" : "Not signed in"}</Text>
                  {signedIn && (
                    <Text textStyle="paragraph/S/regular" color="fg.muted">
                      alex@example.test
                    </Text>
                  )}
                </Stack>
                <Button size="sm" variant="outline" onClick={() => setSignedIn(!signedIn)}>
                  {signedIn ? "Sign out" : "Sign in"}
                </Button>
              </HStack>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
        <SimpleCard>
          <SimpleCardBody>
            <Stack gap="sm">
              <Text textStyle="label/M/medium">Cloud access</Text>
              <Text color="fg.muted">{earlyAccess ? "Early access enabled" : "Coming soon"}</Text>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
        {earlyAccess && signedIn && (
          <>
            <SimpleCard>
              <SimpleCardBody>
                <Stack gap="md">
                  <Text textStyle="label/M/medium">Your devices</Text>
                  {devices.map((name) => (
                    <DeviceRow
                      key={name}
                      name={name}
                      current={name === "This Mac"}
                      onRemove={() => setDevices((current) => current.filter((device) => device !== name))}
                    />
                  ))}
                </Stack>
              </SimpleCardBody>
            </SimpleCard>
            <SimpleCard>
              <SimpleCardBody>
                <Stack gap="sm">
                  <Text textStyle="label/M/medium">This project</Text>
                  <Text>{local ? "Local" : "Synced"}</Text>
                  {local && (
                    <>
                      <Text textStyle="paragraph/S/regular" color="fg.muted">
                        Syncing again merges the copies. Where both copies changed the same thing, one change is kept.
                      </Text>
                      <Button size="sm" variant="primary" alignSelf="flex-start" onClick={() => setLocal(false)}>
                        Sync with Cloud
                      </Button>
                    </>
                  )}
                </Stack>
              </SimpleCardBody>
            </SimpleCard>
            {!local && (
              <AlertMessage
                status="warning"
                title="Make this project local"
                endElement={
                  <Button size="2xs" variant="ghost" onClick={() => setConfirming(true)}>
                    Make local
                  </Button>
                }
              >
                Syncing stops on all devices. Each device keeps its copy.
              </AlertMessage>
            )}
          </>
        )}
      </Stack>
      <DeleteConfirmationModal
        open={confirming}
        onClose={() => setConfirming(false)}
        headline="Make this project local?"
        buttonText="Make local"
        notificationText="Syncing stops on all devices. Each device keeps its copy. Syncing again merges the copies; where both copies changed the same thing, one change is kept."
        onDelete={() => {
          setLocal(true);
        }}
      />
    </ScrollArea>
  );
};

export const CloudSettingsConnected = () => <CloudSettings />;
export const CloudSettingsLocal = () => <CloudSettings initialLocal />;
export const CloudSettingsComingSoon = () => <CloudSettings earlyAccess={false} />;
export const CloudMakeLocalConfirmation = () => <CloudSettings confirmInitiallyOpen />;
