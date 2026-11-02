import { HStack, Input, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, DeleteConfirmationModal, ScrollArea, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { type ReactNode, useState } from "react";
import { Button } from "../components/themed-primitives";
import { CloudIcon, type CloudIconName } from "./cloud-icon";

const SectionTitle = (props: { icon: CloudIconName; children: ReactNode }) => (
  <HStack gap="xs">
    <CloudIcon name={props.icon} />
    <Text textStyle="label/M/medium">{props.children}</Text>
  </HStack>
);

interface DeviceRowProps {
  name: string;
  current: boolean;
  onRemove: () => void;
  onRename: (name: string) => void;
}

const DeviceRow = (props: DeviceRowProps) => {
  const { name, current, onRemove, onRename } = props;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  return (
    <HStack gap="sm" justify="space-between">
      <CloudIcon name={current ? "laptop" : "monitor"} />
      <Stack gap="2xs" flex="1" minW="0">
        {renaming ? (
          <Input size="sm" aria-label="Device name" value={draft} onChange={(event) => setDraft(event.target.value)} />
        ) : (
          <Text>{name}</Text>
        )}
        <Text textStyle="label/S/regular" color="fg.muted">
          {current ? "This device" : "Online"}
        </Text>
      </Stack>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          if (renaming && draft.trim()) onRename(draft.trim());
          setRenaming(!renaming);
        }}
      >
        <CloudIcon name={renaming ? "check" : "pencil"} />
        {renaming ? "Save" : "Rename"}
      </Button>
      <Button size="sm" variant="destructive-ghost" onClick={onRemove}>
        <CloudIcon name="trash-2" />
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
  const [devices, setDevices] = useState([
    { id: "mac", name: "This Mac" },
    { id: "linux", name: "Office Linux" },
  ]);
  return (
    <ScrollArea h="full">
      <Stack gap="md" p="lg">
        <HStack gap="sm">
          <CloudIcon name="cloud" />
          <Text textStyle="heading/S">Cloud</Text>
        </HStack>
        <SimpleCard>
          <SimpleCardBody>
            <Stack gap="sm">
              <SectionTitle icon="user-round">Account</SectionTitle>
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
                  <CloudIcon name={signedIn ? "log-out" : "log-in"} />
                  {signedIn ? "Sign out" : "Sign in"}
                </Button>
              </HStack>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
        <SimpleCard>
          <SimpleCardBody>
            <Stack gap="sm">
              <SectionTitle icon="shield-check">Cloud access</SectionTitle>
              <HStack gap="xs" color="fg.muted">
                <CloudIcon name={earlyAccess ? "circle-check" : "cloud"} />
                <Text>{earlyAccess ? "Early access enabled" : "Coming soon"}</Text>
              </HStack>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
        {earlyAccess && signedIn && (
          <>
            <SimpleCard>
              <SimpleCardBody>
                <Stack gap="md">
                  <SectionTitle icon="monitor">Your devices</SectionTitle>
                  {devices.map((device) => (
                    <DeviceRow
                      key={device.id}
                      name={device.name}
                      current={device.id === "mac"}
                      onRename={(name) =>
                        setDevices((current) =>
                          current.map((entry) => (entry.id === device.id ? { ...entry, name } : entry)),
                        )
                      }
                      onRemove={() => setDevices((current) => current.filter((entry) => entry.id !== device.id))}
                    />
                  ))}
                </Stack>
              </SimpleCardBody>
            </SimpleCard>
            <SimpleCard>
              <SimpleCardBody>
                <Stack gap="sm">
                  <HStack justify="space-between">
                    <SectionTitle icon="folder">This project</SectionTitle>
                    <HStack gap="xs" color={local ? "fg.muted" : "fg.success"}>
                      <CloudIcon name={local ? "cloud-off" : "circle-check"} />
                      <Text>{local ? "Local" : "Synced"}</Text>
                    </HStack>
                  </HStack>
                  {local && (
                    <>
                      <Text textStyle="paragraph/S/regular" color="fg.muted">
                        Syncing again merges the copies. Where both copies changed the same thing, one change is kept.
                      </Text>
                      <Button size="sm" variant="primary" alignSelf="flex-start" onClick={() => setLocal(false)}>
                        <CloudIcon name="cloud-upload" />
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
                    <CloudIcon name="cloud-off" />
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
