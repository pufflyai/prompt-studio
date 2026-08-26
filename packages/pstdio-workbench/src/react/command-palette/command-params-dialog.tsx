import { Button, CloseButton, Dialog, HStack, Stack, Text } from "@chakra-ui/react";
import { handleDialogAcceptShortcut, ScrollArea } from "@pstdio/ui";
import { Fragment, useEffect, useState } from "react";
import type { Command, RegisteredMenuItem, WorkbenchCommandExecutionContext } from "../../core";
import {
  buildCommandParamInitialValues,
  type CommandParamEntry,
  type CommandParamValue,
  isCommandFilesParamValue,
  listCommandParamEntries,
  mergeCommandParamArgs,
  normalizeCommandParamValues,
} from "./command-palette-params";
import { CommandParamField, type CommandParamFieldRenderer } from "./command-param-field";

export interface CommandParamsRequest {
  record: { command: Pick<Command, "id" | "label" | "description" | "params"> };
  action?: RegisteredMenuItem;
  label: string;
  // Confirm-button label for the dialog (defaults to "Run").
  submitLabel?: string;
  args?: unknown;
  context?: WorkbenchCommandExecutionContext;
}

export type { CommandParamFieldProps, CommandParamFieldRenderer } from "./command-param-field";

interface CommandParamsDialogProps {
  request: CommandParamsRequest | null;
  renderParamField?: CommandParamFieldRenderer;
  prepareArgs?: (input: {
    commandId: string;
    args: unknown;
    context?: WorkbenchCommandExecutionContext;
    onArgsChange: (args: unknown) => void;
  }) => Promise<unknown>;
  onClose: () => void;
  onRun: (input: {
    commandId: string;
    args: unknown;
    context?: WorkbenchCommandExecutionContext;
    label: string;
  }) => Promise<void>;
}

const isFilled = (entry: CommandParamEntry, value: CommandParamValue) => {
  if (entry.type === "boolean") return value !== undefined;
  if (isCommandFilesParamValue(value)) return value.refs.length + value.uploads.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.length > 0;
};

export const CommandParamsDialog = (props: CommandParamsDialogProps) => {
  const { request, renderParamField, prepareArgs, onClose, onRun } = props;
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
      const args = mergeCommandParamArgs(request.args, params);
      const preparedArgs = prepareArgs
        ? await prepareArgs({
            commandId: request.record.command.id,
            args,
            context: request.context,
            onArgsChange: (nextArgs) =>
              setValues(buildCommandParamInitialValues(request.record.command.params, nextArgs, request.context)),
          })
        : args;
      await onRun({
        commandId: request.record.command.id,
        args: preparedArgs,
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
        <Dialog.Content
          display="flex"
          flexDirection="column"
          maxH="calc(100% - 48px)"
          onKeyDownCapture={(event) => handleDialogAcceptShortcut(event, () => void run(), isValid && !submitting)}
        >
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
            <ScrollArea h="full" contentProps={{ px: "sm", py: "md" }}>
              {/* Fields carry the param editor's own row padding, so the form is a
                  flush stack of rows rather than rows spaced twice over. */}
              <Stack gap="0">
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
                  <Text textStyle="paragraph/S/regular" color="fg.error" px="sm" pt="xs">
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
