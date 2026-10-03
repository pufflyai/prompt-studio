import { Button, Dialog, Field, HStack, Input, Portal, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { InfoCard } from "@/components/primitives/info-card";
import { SimpleCard, SimpleCardBody } from "@/components/primitives/simple-card";

interface HarnessAction {
  id: string;
  label: string;
  argument?: { label: string; value?: string };
}
interface HarnessMode {
  id: string;
  label: string;
  description: string;
  state: string;
  actions: HarnessAction[];
}
export interface HarnessControlsProps {
  slashCommands?: boolean;
  modes: HarnessMode[];
  query: string;
  pending?: boolean;
  literal?: boolean;
  onLiteralChange: (literal: boolean) => void;
  onAction: (modeId: string, actionId: string, argument?: string) => Promise<void>;
}
const ModeAction = (props: {
  modeId: string;
  action: HarnessAction;
  pending?: boolean;
  onAction: HarnessControlsProps["onAction"];
}) => {
  const { modeId, action, pending, onAction } = props;
  const [open, setOpen] = useState(false);
  const [argument, setArgument] = useState(action.argument?.value ?? "");
  const submit = async () => {
    try {
      await onAction(modeId, action.id, argument);
      setOpen(false);
    } catch {
      /* The conversation owns operation errors. */
    }
  };
  if (!action.argument)
    return (
      <Button
        size="2xs"
        variant="outline"
        disabled={pending}
        onClick={() => {
          void onAction(modeId, action.id).catch(() => {});
        }}
      >
        {action.label}
      </Button>
    );
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        setOpen(details.open);
        if (details.open) setArgument(action.argument?.value ?? "");
      }}
    >
      <Dialog.Trigger asChild>
        <Button size="2xs" variant="outline" disabled={pending}>
          {action.label}
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{action.label}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Field.Root>
                <Field.Label>{action.argument.label}</Field.Label>
                <Input size="sm" value={argument} onChange={(event) => setArgument(event.target.value)} />
              </Field.Root>
            </Dialog.Body>
            <Dialog.Footer>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={pending || !argument.trim()}
                onClick={() => {
                  void submit();
                }}
              >
                Save
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
export const HarnessControls = (props: HarnessControlsProps) => {
  const { modes, query, pending, literal, onLiteralChange, onAction, slashCommands = true } = props;
  const commandInput = slashCommands && /^\/[^\s/]+(?:\s|$)/.test(query);
  if (!modes.length && !commandInput) return null;
  return (
    <Stack gap="xs" aria-label="Harness controls">
      {modes.map((mode) => (
        <SimpleCard key={mode.id}>
          <SimpleCardBody>
            <InfoCard
              title={mode.label}
              description={mode.description}
              infoItems={[{ label: "State", value: mode.state }]}
              actions={
                <HStack flexWrap="wrap" gap="2xs">
                  {mode.actions.map((action) => (
                    <ModeAction
                      key={action.id}
                      modeId={mode.id}
                      action={action}
                      pending={pending}
                      onAction={onAction}
                    />
                  ))}
                </HStack>
              }
            />
          </SimpleCardBody>
        </SimpleCard>
      ))}
      {commandInput ? (
        <HStack gap="xs">
          <Button
            size="2xs"
            variant="outline"
            aria-pressed={Boolean(literal)}
            onClick={() => onLiteralChange(!literal)}
          >
            {literal ? "Send as message" : "Run native command"}
          </Button>
          <Text textStyle="label/XS/regular" color="fg.muted">
            {literal ? "Slash text will be sent as written." : "Select to send slash text as a message."}
          </Text>
        </HStack>
      ) : null}
    </Stack>
  );
};
