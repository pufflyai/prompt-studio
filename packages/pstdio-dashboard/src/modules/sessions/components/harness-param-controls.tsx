import { Box, chakra, Flex, Menu, Portal, Text } from "@chakra-ui/react";
import { ResourceBadge } from "@pstdio/ui";
import { Check, ChevronDown, Circle } from "lucide-react";
import type { HarnessParamsInfo } from "pstdio-api-contracts";
import type { ReactNode } from "react";

export type HarnessParamValues = Record<string, string | boolean>;
type HarnessParamDescriptor = HarnessParamsInfo[string];
type SelectHarnessParamDescriptor = Extract<HarnessParamDescriptor, { type: "select" }>;
type BooleanHarnessParamDescriptor = Extract<HarnessParamDescriptor, { type: "boolean" }>;

interface HarnessParamControlsProps {
  schema: HarnessParamsInfo | undefined;
  defaults?: HarnessParamValues;
  overrides: HarnessParamValues;
  onOverridesChange: (next: HarnessParamValues) => void;
  disabled?: boolean;
}

const labelFor = (key: string, label: string | undefined) => label ?? key.replace(/[-_]/g, " ");

const removeOverride = (overrides: HarnessParamValues, key: string) => {
  const { [key]: _removed, ...rest } = overrides;
  return rest;
};

const nextOverrides = (
  overrides: HarnessParamValues,
  defaults: HarnessParamValues | undefined,
  key: string,
  value: string | boolean,
) => (Object.is(defaults?.[key], value) ? removeOverride(overrides, key) : { ...overrides, [key]: value });

const Trigger = (props: {
  label: string;
  icon: ReactNode;
  tone: "neutral" | "accent";
  disabled?: boolean;
  onClick?: () => void;
}) => {
  const { label, icon, tone, disabled, onClick } = props;

  return (
    <chakra.button type="button" disabled={disabled} aria-label={label} minW="0" flexShrink="0" onClick={onClick}>
      <ResourceBadge fileName={label} icon={icon} size="sm" tone={tone} pointerEvents="none" maxW="12rem" />
    </chakra.button>
  );
};

interface ParamControlProps {
  paramKey: string;
  descriptor: HarnessParamDescriptor;
  defaults: HarnessParamValues | undefined;
  overrides: HarnessParamValues;
  onOverridesChange: (next: HarnessParamValues) => void;
  disabled: boolean;
}

const BooleanParamControl = (
  props: ParamControlProps & { descriptor: BooleanHarnessParamDescriptor; value: string | boolean | undefined },
) => {
  const { paramKey, descriptor, defaults, overrides, onOverridesChange, disabled, value } = props;
  const label = labelFor(paramKey, descriptor.label);
  const booleanValue = value === true;

  return (
    <Trigger
      label={`${label}: ${booleanValue ? "on" : "off"}`}
      disabled={disabled}
      tone={Object.hasOwn(overrides, paramKey) ? "accent" : "neutral"}
      icon={
        <Circle size={10} fill={booleanValue ? "currentColor" : "transparent"} strokeWidth={booleanValue ? 0 : 2} />
      }
      onClick={() => onOverridesChange(nextOverrides(overrides, defaults, paramKey, !booleanValue))}
    />
  );
};

const SelectParamControl = (
  props: ParamControlProps & { descriptor: SelectHarnessParamDescriptor; value: string | boolean | undefined },
) => {
  const { paramKey, descriptor, defaults, overrides, onOverridesChange, disabled, value } = props;
  const label = labelFor(paramKey, descriptor.label);
  const selectedValue = typeof value === "string" ? value : descriptor.options[0]?.value;
  const selectedLabel =
    descriptor.options.find((option) => option.value === selectedValue)?.label ?? selectedValue ?? "unset";
  const isOverride = Object.hasOwn(overrides, paramKey);

  return (
    <Menu.Root lazyMount closeOnSelect>
      <Menu.Trigger asChild>
        <Trigger
          label={`${label}: ${selectedLabel}`}
          disabled={disabled}
          tone={isOverride ? "accent" : "neutral"}
          icon={<ChevronDown size={12} />}
        />
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="12rem">
            {descriptor.options.map((option) => (
              <Menu.Item
                key={option.value}
                value={option.value}
                onClick={() => onOverridesChange(nextOverrides(overrides, defaults, paramKey, option.value))}
              >
                <Flex align="center" gap="2xs" minW="0">
                  <Box w="14px" flexShrink="0">
                    {option.value === selectedValue ? <Check size={14} /> : null}
                  </Box>
                  <Text textStyle="label/XS/medium" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                    {option.label}
                  </Text>
                </Flex>
              </Menu.Item>
            ))}
            {isOverride ? (
              <>
                <Menu.Separator />
                <Menu.Item
                  value={`${paramKey}:reset`}
                  onClick={() => onOverridesChange(removeOverride(overrides, paramKey))}
                >
                  Reset to default
                </Menu.Item>
              </>
            ) : null}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

const ParamControl = (props: ParamControlProps) => {
  const { paramKey, descriptor, defaults, overrides } = props;
  const value = overrides[paramKey] ?? defaults?.[paramKey] ?? descriptor.defaultValue;

  if (descriptor.type === "boolean") {
    return <BooleanParamControl {...props} descriptor={descriptor} value={value} />;
  }

  return <SelectParamControl {...props} descriptor={descriptor} value={value} />;
};

export const HarnessParamControls = (props: HarnessParamControlsProps) => {
  const { schema, defaults, overrides, onOverridesChange, disabled = false } = props;
  const entries = Object.entries(schema ?? {});
  if (entries.length === 0) return null;

  return (
    <Flex align="center" justify="flex-end" gap="2xs" minW="0" overflow="hidden" wrap="nowrap">
      {entries.map(([key, descriptor]) => (
        <ParamControl
          key={key}
          paramKey={key}
          descriptor={descriptor}
          defaults={defaults}
          overrides={overrides}
          onOverridesChange={onOverridesChange}
          disabled={disabled}
        />
      ))}
    </Flex>
  );
};
