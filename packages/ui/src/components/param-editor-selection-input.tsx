import { Box, Button, Flex, Icon, Menu, Text } from "@chakra-ui/react";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ListRow } from "./list-row/list-row";
import { Tooltip } from "./tooltip";

interface Option {
  id: string;
  name: string;
  icon?: string;
}

interface SelectionInputProps {
  id: string;
  defaultValue: string | string[];
  name: string;
  options: Option[];
  onChange: (id: string, value: string | string[]) => void;
  description: string;
  readOnly?: boolean;
  hideLabel?: boolean;
  multiSelect?: boolean;
  tooltipPlacement?: "top" | "right" | "bottom" | "left";
  placeholder?: string;
  fullWidth?: boolean;
}

export const SelectionInput = (props: SelectionInputProps) => {
  const {
    id,
    defaultValue,
    name,
    options,
    onChange,
    description,
    readOnly,
    hideLabel = false,
    multiSelect = false,
    tooltipPlacement = "right",
    placeholder,
    fullWidth = false,
  } = props;
  const [value, setValue] = useState(defaultValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleChange = (nextValue: string | string[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(id, nextValue), 540);
  };

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const isSelected = (optionId: string) => {
    if (multiSelect) {
      return Array.isArray(value) && value.includes(optionId);
    }
    return value === optionId;
  };

  const getDisplayText = () => {
    if (multiSelect) {
      const selectedValues = Array.isArray(value) ? value : [];
      if (selectedValues.length === 0) {
        return placeholder || `Select`;
      }

      const selectedOptions = selectedValues
        .map((id) => options.find((o) => o.id === id))
        .filter(Boolean)
        .map((opt) => opt!.name);

      if (selectedOptions.length <= 3) {
        return selectedOptions.join(", ");
      }
      const displayItems = selectedOptions.slice(0, 3).join(", ");
      const remaining = selectedOptions.length - 3;
      return `${displayItems} +${remaining}`;
    }
    const selectedOption = options.find((o) => o.id === value);
    return selectedOption?.name || "Select";
  };

  const handleSelect = (newValue: string) => {
    if (multiSelect) {
      const currentValues = Array.isArray(value) ? value : [];
      let updatedValues: string[];

      if (currentValues.includes(newValue)) {
        updatedValues = currentValues.filter((v) => v !== newValue);
      } else {
        updatedValues = [...currentValues, newValue];
      }

      setValue(updatedValues);
      scheduleChange(updatedValues);
    } else {
      setValue(newValue);
      scheduleChange(newValue);
    }
  };

  return (
    <Box>
      <Tooltip positioning={{ placement: tooltipPlacement }} content={description} contentProps={{ padding: "xxs" }}>
        {fullWidth ? (
          <Box mb="sm">
            {!hideLabel && (
              <Text textStyle="label/S/medium" color="fg.muted" mb="xs">
                {name}
              </Text>
            )}
            <Menu.Root closeOnSelect={!multiSelect}>
              <Menu.Trigger asChild>
                <Button
                  size="sm"
                  borderWidth="1px"
                  borderStyle="solid"
                  borderColor="border"
                  disabled={readOnly}
                  width="100%"
                >
                  <Flex alignItems="center" justifyContent="space-between" gap="xs" w="full">
                    <Flex alignItems="center" gap="xs">
                      {getDisplayText()}
                    </Flex>
                    <ChevronDown size={14} />
                  </Flex>
                </Button>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content>
                  {options.map((opt) => (
                    <Menu.Item key={opt.id} value={opt.id} asChild>
                      <ListRow
                        asChild
                        variant="compact"
                        id={opt.id}
                        label={opt.name}
                        endContent={multiSelect && isSelected(opt.id) ? <Icon as={Check} boxSize="12px" /> : undefined}
                        onActivate={() => handleSelect(opt.id)}
                      />
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
          </Box>
        ) : (
          <Flex alignItems="center" justifyContent="space-between" minHeight="2rem" mb="sm">
            {!hideLabel && (
              <Text textStyle="label/S/medium" color="fg.muted">
                {name}
              </Text>
            )}
            <Menu.Root closeOnSelect={!multiSelect}>
              <Menu.Trigger asChild>
                <Button size="sm" borderWidth="1px" borderStyle="solid" borderColor="border" disabled={readOnly}>
                  <Flex alignItems="center" gap="xs">
                    {getDisplayText()}
                    <ChevronDown size={14} />
                  </Flex>
                </Button>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content>
                  {options.map((opt) => (
                    <Menu.Item key={opt.id} value={opt.id} asChild>
                      <ListRow
                        asChild
                        variant="compact"
                        id={opt.id}
                        label={opt.name}
                        endContent={multiSelect && isSelected(opt.id) ? <Icon as={Check} boxSize="12px" /> : undefined}
                        onActivate={() => handleSelect(opt.id)}
                      />
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
          </Flex>
        )}
      </Tooltip>
    </Box>
  );
};
