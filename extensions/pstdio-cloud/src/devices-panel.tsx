import { Button, Field, Heading, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { AccountDevice, CloudDevice, CloudDeviceProvider, CloudDeviceProviderInput } from "@pstdio/sdk/extensions";
import { AlertMessage, ScrollArea, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import { providerFormDefaults } from "./provider-form";

interface DevicesPanelProps {
  provider: CloudDeviceProvider;
  devices: CloudDevice[];
  accountDevices: AccountDevice[];
  accountDevicesUnavailable?: boolean;
  busy?: string;
  error?: string;
  elapsed?: number;
  onRefresh: () => void;
  onDismiss: () => void;
  onConfigure: (input: CloudDeviceProviderInput) => void;
  onCreate: (name: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
}

const ProviderForm = (props: Pick<DevicesPanelProps, "provider" | "onConfigure" | "busy">) => {
  const defaults = providerFormDefaults(props.provider);
  const [token, setToken] = useState(defaults.token);
  const [region, setRegion] = useState(defaults.region);
  const [size, setSize] = useState(defaults.size);
  const [image, setImage] = useState(defaults.image);
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack
          gap="sm"
          as="form"
          onSubmit={(event) => {
            event.preventDefault();
            props.onConfigure({ token, region, size, image });
            setToken("");
          }}
        >
          <Heading size="sm">Your DigitalOcean account</Heading>
          <Text>Devices are billed directly by your provider.</Text>
          <Field.Root required>
            <Field.Label>Provider token</Field.Label>
            <Input
              aria-label="Provider token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
            />
          </Field.Root>
          <Field.Root required>
            <Field.Label>Region</Field.Label>
            <Input aria-label="Region" value={region} onChange={(event) => setRegion(event.target.value)} required />
          </Field.Root>
          <Field.Root required>
            <Field.Label>Device size</Field.Label>
            <Input aria-label="Device size" value={size} onChange={(event) => setSize(event.target.value)} required />
          </Field.Root>
          <Field.Root required>
            <Field.Label>Released runtime image digest</Field.Label>
            <Input
              aria-label="Released runtime image digest"
              placeholder="ghcr.io/pufflyai/prompt-studio/device@sha256:…"
              value={image}
              onChange={(event) => setImage(event.target.value)}
              required
            />
          </Field.Root>
          <Button type="submit" disabled={Boolean(props.busy)}>
            Save provider
          </Button>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

const devicePresence = (online: boolean | null) => {
  if (online === null) return "Presence unavailable";
  return online ? "Online" : "Offline";
};

export const DevicesPanel = (props: DevicesPanelProps) => {
  const {
    provider,
    devices,
    accountDevices,
    accountDevicesUnavailable,
    busy,
    error,
    elapsed,
    onRefresh,
    onDismiss,
    onConfigure,
    onCreate,
    onStart,
    onStop,
  } = props;
  const [name, setName] = useState("Cloud device");
  const [editingProvider, setEditingProvider] = useState(false);
  return (
    <Stack height="100%" minHeight="0" gap="md" padding="md">
      <HStack justify="space-between">
        <Heading size="md">Devices</Heading>
        <Button onClick={onRefresh} disabled={Boolean(busy)}>
          Refresh
        </Button>
      </HStack>
      {busy ? (
        <Text role="status">
          {busy} · {elapsed ?? 0}s
        </Text>
      ) : null}
      {!busy && elapsed !== undefined ? <Text color="fg.muted">Request completed in {elapsed}s</Text> : null}
      {error ? (
        <AlertMessage
          status="error"
          title="Device action failed"
          onClose={onDismiss}
          endElement={<Button onClick={onRefresh}>Refresh</Button>}
        >
          {error}
        </AlertMessage>
      ) : null}
      <ScrollArea>
        <Stack gap="md">
          {!provider.configured || editingProvider ? (
            <ProviderForm
              provider={provider}
              busy={busy}
              onConfigure={(input) => {
                onConfigure(input);
                setEditingProvider(false);
              }}
            />
          ) : (
            <HStack justify="space-between">
              <Text>
                {provider.region} · {provider.size}
              </Text>
              <Button onClick={() => setEditingProvider(true)}>Provider settings</Button>
            </HStack>
          )}
          <SimpleCard>
            <SimpleCardBody>
              <Stack
                as="form"
                gap="sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  onCreate(name);
                }}
              >
                <Heading size="sm">Cloud devices</Heading>
                <Text>
                  Stopping keeps your files and device identity. Your provider continues charging for retained
                  resources.
                </Text>
                <Input
                  aria-label="New device name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
                <Button type="submit" disabled={!provider.configured || Boolean(busy)}>
                  Start cloud device
                </Button>
              </Stack>
            </SimpleCardBody>
          </SimpleCard>
          {devices.map((device) => (
            <SimpleCard key={device.id}>
              <SimpleCardBody>
                <Stack gap="sm">
                  <Heading size="sm">{device.name}</Heading>
                  <Text>
                    {device.power} · {devicePresence(device.online)}
                  </Text>
                  <Text color="fg.muted">{device.id}</Text>
                  <HStack>
                    <Button disabled={Boolean(busy) || device.power !== "off"} onClick={() => onStart(device.id)}>
                      Start
                    </Button>
                    <Button disabled={Boolean(busy) || device.power !== "active"} onClick={() => onStop(device.id)}>
                      Stop
                    </Button>
                  </HStack>
                </Stack>
              </SimpleCardBody>
            </SimpleCard>
          ))}
          <Heading size="sm">Your devices</Heading>
          {accountDevicesUnavailable ? (
            <Text>Device presence is unavailable. Provider controls remain available.</Text>
          ) : null}
          {accountDevices.map((device) => (
            <HStack key={device.id} justify="space-between">
              <Text>
                {device.name}
                {device.current ? " · This device" : ""}
              </Text>
              <Text>{device.online ? "Online" : "Offline"}</Text>
            </HStack>
          ))}
        </Stack>
      </ScrollArea>
    </Stack>
  );
};
