import { Button, Flex, type HTMLChakraProps, Icon, Text } from "@chakra-ui/react";
import type { AgentInfo } from "@pstdio/sdk/resources";
import { Check, ChevronDown, Circle } from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import { ScopedMenu as Menu } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import { resolveIconComponent } from "../../utils/resolve-icon-component";
import { Tooltip } from "../primitives/tooltip";
import { harnessParamOptionColor } from "./harness-param-colors";
import { type HarnessParamValues, resolveHarnessParamText, updateHarnessParamOverride } from "./harness-param-values";

type HarnessParamsInfo = NonNullable<AgentInfo["params"]>;

const HarnessParamOptionIcon = (props: { name?: string }) => {
  if (!props.name) return null;
  const icon = resolveIconComponent(props.name);
  if (!icon) return null;
  const color = harnessParamOptionColor(props.name);
  return <Icon as={icon} boxSize="14px" aria-hidden="true" color={color ? `${color}.500` : undefined} />;
};

type HarnessParamDescriptor = HarnessParamsInfo[string];
type SelectHarnessParamDescriptor = Extract<HarnessParamDescriptor, { type: "select" }>;
type BooleanHarnessParamDescriptor = Extract<HarnessParamDescriptor, { type: "boolean" }>;

type ControlSize = "2xs" | "xs" | "sm";

interface HarnessParamInlineControlsProps {
  schema: HarnessParamsInfo | undefined;
  defaults?: HarnessParamValues;
  overrides: HarnessParamValues;
  onOverridesChange: (next: HarnessParamValues) => void;
  disabled?: boolean;
  size?: ControlSize;
}

interface TriggerProps extends HTMLChakraProps<"button"> {
  displayLabel: string;
  ariaLabel: string;
  label: string;
  startIcon?: ReactNode;
  showChevron?: boolean;
  size?: ControlSize;
}

const Trigger = forwardRef<HTMLButtonElement, TriggerProps>((props, ref) => {
  const { displayLabel, ariaLabel, label, startIcon, showChevron = false, size = "sm", ...rest } = props;

  return (
    <Tooltip content={label} closeDelay={150}>
      <Button ref={ref} variant="ghost" size={size} px="2" minW="0" flexShrink="0" aria-label={ariaLabel} {...rest}>
        {startIcon}
        <Text textStyle="label/XS/medium" color="fg" truncate>
          {displayLabel}
        </Text>
        {showChevron ? <ChevronDown size={14} /> : null}
      </Button>
    </Tooltip>
  );
});

interface ParamControlProps {
  paramKey: string;
  descriptor: HarnessParamDescriptor;
  defaults: HarnessParamValues | undefined;
  overrides: HarnessParamValues;
  onOverridesChange: (next: HarnessParamValues) => void;
  disabled: boolean;
  size: ControlSize;
}

const BooleanParamControl = (
  props: ParamControlProps & { descriptor: BooleanHarnessParamDescriptor; value: string | boolean | undefined },
) => {
  const { paramKey, descriptor, defaults, overrides, onOverridesChange, disabled, value, size } = props;
  const label = resolveHarnessParamText(paramKey, descriptor.label);
  const booleanValue = value === true;

  return (
    <Trigger
      displayLabel={`${label}: ${booleanValue ? "on" : "off"}`}
      ariaLabel={`${label}: ${booleanValue ? "on" : "off"}`}
      label={label}
      disabled={disabled}
      size={size}
      startIcon={
        <Circle size={10} fill={booleanValue ? "currentColor" : "transparent"} strokeWidth={booleanValue ? 0 : 2} />
      }
      onClick={() => onOverridesChange(updateHarnessParamOverride(overrides, defaults, paramKey, !booleanValue))}
    />
  );
};

const SelectParamControl = (
  props: ParamControlProps & { descriptor: SelectHarnessParamDescriptor; value: string | boolean | undefined },
) => {
  const { paramKey, descriptor, defaults, overrides, onOverridesChange, disabled, value, size } = props;
  const label = resolveHarnessParamText(paramKey, descriptor.label);
  const selectedValue = typeof value === "string" ? value : descriptor.options[0]?.value;
  const selectedOption = descriptor.options.find((option) => option.value === selectedValue);
  const selectedLabel = selectedOption?.label ?? selectedValue ?? "unset";

  return (
    <Menu.Root lazyMount closeOnSelect positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <Trigger
          displayLabel={selectedLabel}
          ariaLabel={`${label}: ${selectedLabel}`}
          label={label}
          disabled={disabled}
          size={size}
          startIcon={selectedOption?.icon ? <HarnessParamOptionIcon name={selectedOption.icon} /> : undefined}
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
                  role="menuitemradio"
                  aria-checked={option.value === selectedValue}
                  disabled={disabled}
                  onSelect={() => {
                    if (!disabled)
                      onOverridesChange(updateHarnessParamOverride(overrides, defaults, paramKey, option.value));
                  }}
                >
                  <HarnessParamOptionIcon name={option.icon} />
                  <Menu.ItemText>{option.label}</Menu.ItemText>
                  {option.value === selectedValue ? <Check size={14} /> : null}
                </Menu.Item>
              ))}
            </Menu.ItemGroup>
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

export const HarnessParamInlineControls = (props: HarnessParamInlineControlsProps) => {
  const { schema, defaults, overrides, onOverridesChange, disabled = false, size = "sm" } = props;
  const entries = Object.entries(schema ?? {}).filter(([, descriptor]) => descriptor.control !== "command");
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
          size={size}
        />
      ))}
    </Flex>
  );
};
