import { Button, HStack, Input, Menu, Stack, Text, Textarea } from "@chakra-ui/react";
import { Checkbox } from "@pstdio/ui";
import { ChevronDown, Circle, CircleDot } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkbenchCommandExecutionContext } from "../../core";
import type { CommandParamEntry, CommandParamValue } from "./command-palette-params";

export interface CommandParamFieldProps {
  entry: CommandParamEntry;
  value: CommandParamValue;
  context?: WorkbenchCommandExecutionContext;
  disabled: boolean;
  onChange: (value: CommandParamValue) => void;
}

// Lets the host supply field UI for param types the workbench cannot render on its
// own (e.g. harness/repo selectors backed by host data). Returning a falsy value
// defers to the built-in field for that entry.
export type CommandParamFieldRenderer = (props: CommandParamFieldProps) => ReactNode;

type BuiltInParamFieldProps = Omit<CommandParamFieldProps, "context">;

const getStringValue = (value: CommandParamValue) => (typeof value === "string" ? value : "");

const getStringArrayValue = (value: CommandParamValue) => (Array.isArray(value) ? value : []);

const FieldLabel = (props: { entry: CommandParamEntry }) => (
  <Stack gap="2xs">
    <Text textStyle="label/S/medium">
      {props.entry.label}
      {props.entry.required ? " *" : ""}
    </Text>
    {props.entry.description ? (
      <Text textStyle="paragraph/XS/regular" color="fg.muted">
        {props.entry.description}
      </Text>
    ) : null}
  </Stack>
);

const TextParamField = (props: BuiltInParamFieldProps) => (
  <Stack gap="2xs">
    <FieldLabel entry={props.entry} />
    <Input
      size="sm"
      value={getStringValue(props.value)}
      onChange={(event) => props.onChange(event.target.value)}
      disabled={props.disabled}
    />
  </Stack>
);

const NumberParamField = (props: BuiltInParamFieldProps) => (
  <Stack gap="2xs">
    <FieldLabel entry={props.entry} />
    <Input
      size="sm"
      type="number"
      inputMode="decimal"
      value={getStringValue(props.value)}
      onChange={(event) => props.onChange(event.target.value)}
      disabled={props.disabled}
    />
  </Stack>
);

const LongTextParamField = (props: BuiltInParamFieldProps) => (
  <Stack gap="2xs">
    <FieldLabel entry={props.entry} />
    <Textarea
      size="sm"
      minH="120px"
      value={getStringValue(props.value)}
      onChange={(event) => props.onChange(event.target.value)}
      disabled={props.disabled}
    />
  </Stack>
);

const SelectParamField = (props: BuiltInParamFieldProps) => {
  const value = getStringValue(props.value);
  const selectedLabel = props.entry.options?.find((option) => option.value === value)?.label ?? value;

  if (!props.entry.options?.length) return <TextParamField {...props} />;

  return (
    <Stack gap="2xs">
      <FieldLabel entry={props.entry} />
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button size="sm" variant="outline" justifyContent="space-between" disabled={props.disabled}>
            {selectedLabel || "Select..."}
            <ChevronDown size={14} aria-hidden="true" />
          </Button>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content>
            {props.entry.options.map((option) => (
              <Menu.Item key={option.value} value={option.value} onClick={() => props.onChange(option.value)}>
                <HStack gap="2" minW="0">
                  {value === option.value ? (
                    <CircleDot size={14} aria-hidden="true" />
                  ) : (
                    <Circle size={14} aria-hidden="true" />
                  )}
                  <Text truncate>{option.label}</Text>
                </HStack>
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </Stack>
  );
};

const MultiSelectParamField = (props: BuiltInParamFieldProps) => {
  const selected = getStringArrayValue(props.value);
  if (!props.entry.options?.length) return <JsonParamField {...props} />;

  const toggle = (optionValue: string, checked: boolean | "indeterminate") => {
    props.onChange(
      checked === true
        ? Array.from(new Set([...selected, optionValue]))
        : selected.filter((value) => value !== optionValue),
    );
  };

  return (
    <Stack gap="2xs">
      <FieldLabel entry={props.entry} />
      <Stack gap="2xs">
        {props.entry.options.map((option) => (
          <Checkbox
            key={option.value}
            size="sm"
            checked={selected.includes(option.value)}
            disabled={props.disabled}
            onCheckedChange={(details) => toggle(option.value, details.checked)}
          >
            {option.label}
          </Checkbox>
        ))}
      </Stack>
    </Stack>
  );
};

const BooleanParamField = (props: BuiltInParamFieldProps) => (
  <Stack gap="2xs">
    <FieldLabel entry={props.entry} />
    <Checkbox
      size="sm"
      checked={props.value === true}
      disabled={props.disabled}
      onCheckedChange={(details) => props.onChange(details.checked === true)}
    >
      Enabled
    </Checkbox>
  </Stack>
);

const JsonParamField = (props: BuiltInParamFieldProps) => (
  <Stack gap="2xs">
    <FieldLabel entry={props.entry} />
    <Textarea
      size="sm"
      minH="88px"
      fontFamily="mono"
      value={getStringValue(props.value)}
      placeholder="JSON value"
      onChange={(event) => props.onChange(event.target.value)}
      disabled={props.disabled}
    />
  </Stack>
);

export const CommandParamField = (props: BuiltInParamFieldProps) => {
  if (props.entry.type === "longtext") return <LongTextParamField {...props} />;
  if (props.entry.type === "number") return <NumberParamField {...props} />;
  if (props.entry.type === "boolean") return <BooleanParamField {...props} />;
  if (props.entry.type === "select" || props.entry.type === "template") return <SelectParamField {...props} />;
  if (props.entry.type === "multi-select") return <MultiSelectParamField {...props} />;
  if (
    props.entry.type === "json" ||
    props.entry.type === "resource" ||
    props.entry.type === "repo" ||
    props.entry.type === "harness"
  )
    return <JsonParamField {...props} />;
  return <TextParamField {...props} />;
};
