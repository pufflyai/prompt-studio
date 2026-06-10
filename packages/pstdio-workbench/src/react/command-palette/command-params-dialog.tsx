import { Button, CloseButton, Dialog, HStack, Input, Menu, Stack, Text, Textarea } from "@chakra-ui/react";
import { Checkbox, ScrollArea } from "@pstdio/ui";
import { Check, ChevronDown } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import type { Command, RegisteredMenuItem, WorkbenchCommandExecutionContext } from "../../core";
import {
  buildCommandParamInitialValues,
  type CommandParamEntry,
  type CommandParamValue,
  listCommandParamEntries,
  mergeCommandParamArgs,
  normalizeCommandParamValues,
} from "./command-palette-params";

export interface CommandParamsRequest {
  record: { command: Pick<Command, "id" | "label" | "description" | "params"> };
  action?: RegisteredMenuItem;
  label: string;
  // Confirm-button label for the dialog (defaults to "Run").
  submitLabel?: string;
  args?: unknown;
  context?: WorkbenchCommandExecutionContext;
}

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

interface CommandParamsDialogProps {
  request: CommandParamsRequest | null;
  renderParamField?: CommandParamFieldRenderer;
  onClose: () => void;
  onRun: (input: {
    commandId: string;
    args: unknown;
    context?: WorkbenchCommandExecutionContext;
    label: string;
  }) => Promise<void>;
}

const getStringValue = (value: CommandParamValue) => (typeof value === "string" ? value : "");

const getStringArrayValue = (value: CommandParamValue) => (Array.isArray(value) ? value : []);

const isFilled = (entry: CommandParamEntry, value: CommandParamValue) => {
  if (entry.type === "boolean") return value !== undefined;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.length > 0;
};

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

const TextParamField = (props: {
  entry: CommandParamEntry;
  value: CommandParamValue;
  disabled: boolean;
  onChange: (value: CommandParamValue) => void;
}) => (
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

const NumberParamField = (props: {
  entry: CommandParamEntry;
  value: CommandParamValue;
  disabled: boolean;
  onChange: (value: CommandParamValue) => void;
}) => (
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

const LongTextParamField = (props: {
  entry: CommandParamEntry;
  value: CommandParamValue;
  disabled: boolean;
  onChange: (value: CommandParamValue) => void;
}) => (
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

const SelectParamField = (props: {
  entry: CommandParamEntry;
  value: CommandParamValue;
  disabled: boolean;
  onChange: (value: CommandParamValue) => void;
}) => {
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
                  {value === option.value ? <Check size={14} aria-hidden="true" /> : null}
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

const MultiSelectParamField = (props: {
  entry: CommandParamEntry;
  value: CommandParamValue;
  disabled: boolean;
  onChange: (value: CommandParamValue) => void;
}) => {
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

const BooleanParamField = (props: {
  entry: CommandParamEntry;
  value: CommandParamValue;
  disabled: boolean;
  onChange: (value: CommandParamValue) => void;
}) => (
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

const JsonParamField = (props: {
  entry: CommandParamEntry;
  value: CommandParamValue;
  disabled: boolean;
  onChange: (value: CommandParamValue) => void;
}) => (
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

const CommandParamField = (props: {
  entry: CommandParamEntry;
  value: CommandParamValue;
  disabled: boolean;
  onChange: (value: CommandParamValue) => void;
}) => {
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

export const CommandParamsDialog = (props: CommandParamsDialogProps) => {
  const { request, renderParamField, onClose, onRun } = props;
  const [values, setValues] = useState<Record<string, CommandParamValue>>({});
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const entries = listCommandParamEntries(request?.record.command.params);

  useEffect(() => {
    setValues(buildCommandParamInitialValues(request?.record.command.params, request?.args, request?.context));
    setError(undefined);
    setSubmitting(false);
  }, [request]);

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const setValue = (key: string, value: CommandParamValue) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const run = async () => {
    if (!request || submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const params = normalizeCommandParamValues(request.record.command.params, values);
      await onRun({
        commandId: request.record.command.id,
        args: mergeCommandParamArgs(request.args, params),
        context: request.context,
        label: request.label,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Command failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = entries.every((entry) => !entry.required || isFilled(entry, values[entry.key]));

  return (
    <Dialog.Root
      open={request !== null}
      size="lg"
      scrollBehavior="inside"
      onOpenChange={(details) => !details.open && close()}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content display="flex" flexDirection="column" maxH="calc(100% - 48px)">
          <Dialog.Header>
            <Stack gap="2xs" minW="0">
              <Text textStyle="heading/M/semibold">{request?.label ?? "Run command"}</Text>
              {request?.record.command.description ? (
                <Text textStyle="paragraph/XS/regular" color="fg.muted" truncate>
                  {request.record.command.description}
                </Text>
              ) : null}
            </Stack>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" disabled={submitting} />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body flex="1" minH="0" p="0">
            <ScrollArea h="full" contentProps={{ p: "md" }}>
              <Stack gap="md">
                {entries.map((entry) => {
                  const fieldProps = {
                    entry,
                    value: values[entry.key],
                    disabled: submitting,
                    onChange: (value: CommandParamValue) => setValue(entry.key, value),
                  };
                  const custom = renderParamField?.({ ...fieldProps, context: request?.context });
                  return <Fragment key={entry.key}>{custom ?? <CommandParamField {...fieldProps} />}</Fragment>;
                })}
                {error ? (
                  <Text textStyle="paragraph/S/regular" color="fg.error">
                    {error}
                  </Text>
                ) : null}
              </Stack>
            </ScrollArea>
          </Dialog.Body>
          <Dialog.Footer>
            <HStack gap="2">
              <Button size="sm" variant="ghost" disabled={submitting} onClick={close}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" disabled={!isValid} loading={submitting} onClick={() => void run()}>
                {request?.submitLabel ?? "Run"}
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
