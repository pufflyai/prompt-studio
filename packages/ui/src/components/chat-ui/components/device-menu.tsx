import { Box, Button, HStack, Icon, Menu, Text } from "@chakra-ui/react";
import { ChevronDown, Monitor } from "lucide-react";
import { ListRow } from "@/components/list-row/list-row";
import { SearchableMenu, type SearchableMenuItem } from "@/components/overlays/searchable-menu";
import { Tooltip } from "@/components/primitives/tooltip";

export interface ChatDeviceOption {
  id: string;
  name: string;
  /** The device showing this view. */
  current?: boolean;
  disabled?: boolean;
}

interface ChatDeviceMenuProps {
  devices: ChatDeviceOption[];
  selectedDeviceId: string;
  selectedDeviceName?: string;
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
export const ChatDeviceMenu = (props: ChatDeviceMenuProps) => {
  const { devices, selectedDeviceId, selectedDeviceName, onSelectDevice, isDisabled = false } = props;
  const selected = devices.find((device) => device.id === selectedDeviceId);
  const label = selected?.current ? "This device" : (selected?.name ?? selectedDeviceName ?? "This device");

  if (isDisabled) {
    return (
      <Tooltip content={`Runs on ${label.toLowerCase() === "this device" ? "this device" : label}`}>
        <HStack gap="2xs" px="2xs" minW="0" tabIndex={0} data-testid="session-device">
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
          isDisabled: device.disabled,
          onSelect: () => {
            if (!device.disabled) onSelectDevice?.(device.id);
          },
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
