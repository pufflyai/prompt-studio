import { Box, Button, HStack, Icon, Menu, Text } from "@chakra-ui/react";
import { ListRow, SearchableMenu, type SearchableMenuItem, Tooltip } from "@pstdio/ui";
import { ChevronDown, Monitor } from "lucide-react";

export interface SessionDeviceOption {
  id: string;
  name: string;
}

interface SessionDeviceMenuProps {
  devices: SessionDeviceOption[];
  selectedDeviceId: string;
  onSelectDevice?: (deviceId: string) => void;
  /** An existing session stays on the device that runs it. */
  isDisabled?: boolean;
}

const DeviceLabel = (props: { label: string }) => (
  <>
    <Icon as={Monitor} boxSize="14px" color="fg" />
    <Text textStyle="label/XS/medium" color="fg" truncate>
      {props.label}
    </Text>
  </>
);

/** The device a session runs on, shown before the workspace it runs in. */
export const SessionDeviceMenu = (props: SessionDeviceMenuProps) => {
  const { devices, selectedDeviceId, onSelectDevice, isDisabled = false } = props;
  const label = devices.find((device) => device.id === selectedDeviceId)?.name ?? "This device";

  if (isDisabled) {
    return (
      <Tooltip content={label === "This device" ? "Runs on this device" : `Runs on ${label}`}>
        <HStack gap="2xs" px="2xs" minW="0" data-testid="session-device">
          <DeviceLabel label={label} />
        </HStack>
      </Tooltip>
    );
  }

  return (
    <SearchableMenu
      trigger={
        <Box minW="0">
          <Tooltip content="Select device">
            <Button variant="ghost" size="xs" px="2xs" gap="2xs" minW="0" aria-label="Select device">
              <DeviceLabel label={label} />
              <Icon as={ChevronDown} boxSize="14px" color="fg.muted" />
            </Button>
          </Tooltip>
        </Box>
      }
      items={devices.map(
        (device): SearchableMenuItem => ({
          id: device.id,
          label: device.name,
          icon: Monitor,
          isSelected: device.id === selectedDeviceId,
          onSelect: () => onSelectDevice?.(device.id),
        }),
      )}
      width="240px"
      showSearch={devices.length > 10}
      searchPlaceholder="Search devices..."
      contentTestId="session-device-options"
      emptyState={
        <Menu.Item value="empty" asChild>
          <ListRow
            asChild
            variant="compact"
            id="empty"
            label="No devices"
            icon={<Icon as={Monitor} boxSize="16px" />}
            disabled
          />
        </Menu.Item>
      }
    />
  );
};
