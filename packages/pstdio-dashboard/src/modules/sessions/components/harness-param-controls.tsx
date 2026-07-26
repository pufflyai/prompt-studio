import { Box, Button, Flex, type HTMLChakraProps, Menu, Portal, Text } from "@chakra-ui/react";
import { WorkbenchIcon } from "@pstdio/workbench/react";
import { Check, ChevronDown, Circle } from "lucide-react";
import type { HarnessParamsInfo } from "pstdio-api-contracts";
import { forwardRef, type ReactNode } from "react";

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

// Harness param labels are Localizable; resolve before rendering so an l10n
// object never reaches the DOM as "[object Object]".
const labelFor = (key: string, label: string | { $l10n: string; default?: string } | undefined) => {
  if (typeof label === "string") return label;
  if (label) return label.default ?? label.$l10n;
  return key.replace(/[-_]/g, " ");
};

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

interface TriggerProps extends HTMLChakraProps<"button"> {
  displayLabel: string;
  ariaLabel: string;
  startIcon?: ReactNode;
  tone: "neutral" | "accent";
  showChevron?: boolean;
}

const Trigger = forwardRef<HTMLButtonElement, TriggerProps>((props, ref) => {
  const { displayLabel, ariaLabel, startIcon, tone, showChevron = false, ...rest } = props;
  const accentProps =
    tone === "accent" ? { color: "var(--schub-foreground-accent)", bg: "var(--schub-accent-subtle)" } : {};

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="sm"
      px="2"
      minW="0"
      flexShrink="0"
      aria-label={ariaLabel}
      {...accentProps}
      {...rest}
    >
      {startIcon}
      <Text textStyle="label/XS/medium" color="fg" truncate>
        {displayLabel}
      </Text>
      {showChevron ? <ChevronDown size={14} /> : null}
    </Button>
  );
});

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
      displayLabel={`${label}: ${booleanValue ? "on" : "off"}`}
      ariaLabel={`${label}: ${booleanValue ? "on" : "off"}`}
      disabled={disabled}
      tone={Object.hasOwn(overrides, paramKey) ? "accent" : "neutral"}
      startIcon={
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
  const selectedOption = descriptor.options.find((option) => option.value === selectedValue);
  const selectedLabel = selectedOption?.label ?? selectedValue ?? "unset";
  const isOverride = Object.hasOwn(overrides, paramKey);

  return (
    <Menu.Root lazyMount closeOnSelect positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <Trigger
          displayLabel={selectedLabel}
          ariaLabel={`${label}: ${selectedLabel}`}
          disabled={disabled}
          tone={isOverride ? "accent" : "neutral"}
          startIcon={selectedOption?.icon ? <WorkbenchIcon name={selectedOption.icon} size={14} /> : undefined}
          showChevron
        />
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="12rem">
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel>{label}</Menu.ItemGroupLabel>
              {descriptor.options.map((option) => (
                <Menu.Item
                  key={option.value}
                  value={option.value}
                  onSelect={() => onOverridesChange(nextOverrides(overrides, defaults, paramKey, option.value))}
                >
                  <Box
                    display="grid"
                    gridTemplateColumns="14px 14px minmax(0, 1fr)"
                    alignItems="center"
                    gap="2xs"
                    w="full"
                  >
                    <Box display="flex" justifyContent="flex-start">
                      {option.value === selectedValue ? <Check size={14} /> : null}
                    </Box>
                    <Box display="flex" justifyContent="center">
                      <WorkbenchIcon name={option.icon} size={14} />
                    </Box>
                    <Text textStyle="label/XS/medium" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                      {option.label}
                    </Text>
                  </Box>
                </Menu.Item>
              ))}
            </Menu.ItemGroup>
            {isOverride ? (
              <>
                <Menu.Separator />
                <Menu.Item
                  value={`${paramKey}:reset`}
                  onSelect={() => onOverridesChange(removeOverride(overrides, paramKey))}
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
    <Flex align="center" justify="flex-end" gap="2xs" minW="0" wrap="wrap">
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
