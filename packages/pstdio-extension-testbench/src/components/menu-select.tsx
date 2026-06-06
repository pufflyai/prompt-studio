import { Button, Icon, Menu, Portal, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";

interface MenuSelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface MenuSelectProps<T extends string> {
  label: string;
  value: T;
  options: MenuSelectOption<T>[];
  onSelect: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  size?: "xs" | "sm";
  flex?: string;
  minW?: string;
  width?: string;
  contentMinW?: string;
}

export const MenuSelect = <T extends string>(props: MenuSelectProps<T>) => {
  const {
    contentMinW = "220px",
    disabled = false,
    flex,
    id,
    label,
    minW,
    onSelect,
    options,
    placeholder,
    size = "sm",
    value,
    width,
  } = props;
  const selectedOption = options.find((option) => option.value === value);
  const triggerLabel = selectedOption?.label ?? placeholder ?? label;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          aria-label={label}
          disabled={disabled}
          flex={flex}
          id={id}
          justifyContent="space-between"
          minW={minW}
          size={size}
          type="button"
          variant="outline"
          width={width}
        >
          <Text as="span" truncate>
            {triggerLabel}
          </Text>
          <Icon as={ChevronDown} boxSize={size === "xs" ? "12px" : "14px"} color="fg.muted" flexShrink="0" />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW={contentMinW} bg="bg">
            {options.map((option) => (
              <Menu.Item key={option.value} value={option.value} asChild>
                <ListRow
                  asChild
                  variant="compact"
                  id={option.value}
                  label={option.label}
                  description={option.description}
                  isSelected={option.value === value}
                  onActivate={() => onSelect(option.value)}
                />
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
