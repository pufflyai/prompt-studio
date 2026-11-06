import { Button, Stack, Text } from "@chakra-ui/react";
import { workspaceControlValueSchema } from "pstdio-api-contracts";
import { useState } from "react";
import type { NativeChatWorkspaceProps } from "./native-chat-workspace";

export const NativeWorkspaceCreation = (props: NativeChatWorkspaceProps & { disabled: boolean }) => {
  const { conversation, draft, changeValues, renderParamField, run, disabled } = props;
  const [validation, setValidation] = useState<string | undefined>("Choose a workspace type.");
  const [pending, setPending] = useState(false);
  const binding = conversation.workspace;
  if (!binding?.create) return null;
  const value = draft.values[binding.controlId];
  const parsed = workspaceControlValueSchema.safeParse(value);
  if (!parsed.success) return null;
  const updateValue = (update: (current: string) => unknown) => {
    if (disabled || pending) return;
    changeValues((current) => {
      const next = update(JSON.stringify(current[binding.controlId]));
      if (typeof next !== "string") return current;
      const result = workspaceControlValueSchema.safeParse(JSON.parse(next));
      return result.success ? { ...current, [binding.controlId]: result.data } : current;
    });
  };
  const fields = renderParamField?.({
    entry: {
      key: binding.controlId,
      type: "workspace",
      label: "Workspace type",
      required: true,
      providers: binding.create.providers,
    },
    value: JSON.stringify(parsed.data),
    disabled: disabled || pending,
    onChange: (next) => updateValue(() => next),
    onUpdateValue: (update) => updateValue(update),
    onValidationChange: setValidation,
  });
  return (
    <Stack gap="xs" px="xs" pb="xs">
      {fields ?? <Text role="alert">Workspace creation is unavailable in this host.</Text>}
      {validation && (
        <Text color="fg.muted" textStyle="label/XS/regular">
          {validation}
        </Text>
      )}
      {binding.create.disabledReason && <Text>{binding.create.disabledReason}</Text>}
      <Button
        size="xs"
        variant="subtle"
        alignSelf="start"
        disabled={
          disabled ||
          pending ||
          Boolean(validation || binding.create.disabledReason) ||
          !parsed.data.providerId ||
          !fields
        }
        loading={pending}
        onClick={() => {
          setPending(true);
          void run({ type: "operation", id: binding.create!.actionId, values: props.currentValues?.() ?? draft.values })
            .catch(() => undefined)
            .finally(() => setPending(false));
        }}
      >
        Create workspace
      </Button>
    </Stack>
  );
};
