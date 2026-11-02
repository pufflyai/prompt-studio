import { Icon, IconButton, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { ScopedPopover as Popover } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import { resolveIconComponent } from "../../utils/resolve-icon-component";
import { getIconComponent, type IconColorPickerIconOption, optionIcons } from "./icon-options";
import { IconPickerGrid } from "./icon-picker-grid";

export interface IconPickerProps {
  value?: string | null;
  options?: readonly IconColorPickerIconOption[];
  disabled?: boolean;
  onChange(value: string | null): void;
  "aria-label"?: string;
}

export const IconPicker = (props: IconPickerProps) => {
  const { value, options = optionIcons, disabled, onChange, "aria-label": label = "Change icon" } = props;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const icon = value ? resolveIconComponent(value) : undefined;
  const selected = options.find((option) => option.icon === icon)?.value ?? value;
  return (
    <Popover.Root open={open} onOpenChange={({ open }) => setOpen(open)} positioning={{ placement: "bottom-start" }}>
      <Popover.Trigger asChild>
        <IconButton
          variant="ghost"
          size="2xs"
          disabled={disabled}
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
        >
          <Icon as={icon ?? getIconComponent(value, options)} boxSize="icon-xs" />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="tag-picker" bg="bg.elevated" onClick={(event) => event.stopPropagation()}>
            <Stack gap="compact" p="sm">
              <Text textStyle="label/S/medium" color="fg.muted">
                Icon
              </Text>
              <IconPickerGrid
                value={selected}
                options={options}
                disabled={disabled}
                onChange={(next) => {
                  onChange(next);
                  setOpen(false);
                }}
              />
            </Stack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
