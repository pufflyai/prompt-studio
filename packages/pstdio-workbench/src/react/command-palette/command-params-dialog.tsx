import { Box, Button, CloseButton, Dialog, HStack, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, handleDialogAcceptShortcut, ScrollArea } from "@pstdio/ui";
import { Fragment, useState } from "react";
import type { Command, RegisteredMenuItem, WorkbenchCommandExecutionContext } from "../../core";
import type { ExecuteOptionCommand } from "./command-option-resolver";
import { CommandOptionStatus } from "./command-option-status";
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
import { useCommandOptions } from "./use-command-options";

export interface CommandParamsRequest {
  record: { command: Pick<Command, "id" | "label" | "description" | "params" | "resourceMutation"> };
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
  executeOptionCommand?: ExecuteOptionCommand;
  prepareArgs?: (input: {
    commandId: string;
    args: unknown;
    context?: WorkbenchCommandExecutionContext;
    onArgsChange: (args: unknown) => void;
  }) => Promise<unknown>;
  onRunError?: (label: string, error: unknown) => void;
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
  const [current, setCurrent] = useState({ request: props.request, revision: 0 });
  if (current.request !== props.request) {
    setCurrent({ request: props.request, revision: current.revision + 1 });
  }
  return props.request ? <CommandParamsForm key={current.revision} {...props} request={props.request} /> : null;
};

const CommandParamsForm = (props: CommandParamsDialogProps & { request: CommandParamsRequest }) => {
  const { request, renderParamField, prepareArgs, executeOptionCommand, onClose, onRun, onRunError } = props;
  const [values, setValues] = useState<Record<string, CommandParamValue>>(() =>
    buildCommandParamInitialValues(request.record.command.params, request.args, request.context),
  );
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const entries = listCommandParamEntries(request?.record.command.params);

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const setValue = (key: string, value: CommandParamValue) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const options = useCommandOptions(request.record.command.params ?? {}, values, executeOptionCommand, setValue);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const run = async () => {
    if (!request || submitting) return;
    const invalid = options.validate(values);
    setFieldErrors(invalid);
    if (Object.keys(invalid).length > 0) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const params = normalizeCommandParamValues(request.record.command.params, values);
      const args = mergeCommandParamArgs(request.args, params, request.record.command.params);
      const preparedArgs = prepareArgs
        ? await prepareArgs({
            commandId: request.record.command.id,
            args,
            context: request.context,
            onArgsChange: (nextArgs) =>
              setValues(buildCommandParamInitialValues(request.record.command.params, nextArgs, request.context)),
          })
        : args;
      const submission = {
        commandId: request.record.command.id,
        args: preparedArgs,
        context: request.context,
        label: request.label,
      };
      if (request.record.command.resourceMutation) {
        onClose();
        void onRun(submission).catch((caught) => onRunError?.(request.label, caught));
        return;
      }
      await onRun(submission);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Command failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const isValid =
    Object.keys(options.validate(values)).length === 0 &&
    entries.every((entry) => !entry.required || isFilled(entry, values[entry.key]));

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
              <Dialog.Title>{request?.label ?? "Run command"}</Dialog.Title>
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
                  const state = options.states[entry.key];
                  const dynamic = entry.options && !Array.isArray(entry.options);
                  const fieldProps = {
                    entry: dynamic ? { ...entry, options: state?.options ?? [] } : entry,
                    value: values[entry.key],
                    disabled: submitting || Boolean(dynamic && state?.status !== "ready"),
                    onChange: (value: CommandParamValue) => setValue(entry.key, value),
                  };
                  const custom = renderParamField?.({ ...fieldProps, context: request?.context });
                  return (
                    <Fragment key={entry.key}>
                      {custom ?? <CommandParamField {...fieldProps} />}
                      {dynamic ? <CommandOptionStatus state={state} onRetry={() => options.retry(entry.key)} /> : null}
                      {fieldErrors[entry.key] ? (
                        <Text role="alert" px="sm" textStyle="paragraph/XS/regular" color="fg.error">
                          {fieldErrors[entry.key]}
                        </Text>
                      ) : null}
                    </Fragment>
                  );
                })}
              </Stack>
            </ScrollArea>
          </Dialog.Body>
          {/* Outside the scroll area, so the reason stays next to Run however long the form is. */}
          {error ? (
            <Box px="lg" pb="md">
              <AlertMessage status="error" title={error} role="alert" />
            </Box>
          ) : null}
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
