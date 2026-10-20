import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { AccountDevice } from "@pstdio/sdk/client";
import { DeleteConfirmationModal } from "@pstdio/ui";
import { useState } from "react";

interface DeviceListProps {
  devices: AccountDevice[];
  busy?: boolean;
  online?: boolean;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}
const DeviceRow = (props: Omit<DeviceListProps, "devices"> & { device: AccountDevice }) => {
  const { device, busy, online, onRename, onRemove } = props;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(device.name);
  const [removing, setRemoving] = useState(false);
  return (
    <Stack gap="xs" py="md" borderBottomWidth="1px" borderColor="border">
      <Text textStyle="label/M/medium">
        {device.name}
        {device.current ? " · This device" : ""}
      </Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        {device.platform} · {device.current && online ? "Online" : "Online status unavailable"}
      </Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        Last seen {new Date(device.lastSeenAt).toLocaleString()}
      </Text>
      {editing ? (
        <HStack gap="sm" flexWrap="wrap">
          <Input
            size="sm"
            aria-label={`Name for ${device.name}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !name.trim()}
            onClick={() => {
              onRename(device.id, name.trim());
              setEditing(false);
            }}
          >
            Save name
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </HStack>
      ) : (
        <HStack gap="sm">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
            Rename
          </Button>
          <Button size="sm" variant="destructive-ghost" disabled={busy} onClick={() => setRemoving(true)}>
            Remove
          </Button>
        </HStack>
      )}
      <DeleteConfirmationModal
        open={removing}
        onClose={() => setRemoving(false)}
        headline={`Remove ${device.name}?`}
        buttonText="Remove device"
        notificationText="This device will stop renewing Cloud access. Downloaded data stays on it."
        onDelete={() => onRemove(device.id)}
      />
    </Stack>
  );
};
export const DeviceList = (props: DeviceListProps) => {
  const { devices, ...rest } = props;
  return (
    <Stack gap="sm">
      <Text textStyle="heading/S">Devices</Text>
      {devices.length === 0 ? (
        <Text color="fg.muted">No devices to show.</Text>
      ) : (
        devices.map((device) => <DeviceRow key={device.id} device={device} {...rest} />)
      )}
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        Removing a device stops future access renewal. Downloaded data stays on it.
      </Text>
    </Stack>
  );
};
