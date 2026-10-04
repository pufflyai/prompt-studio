import {
  Button,
  chakra,
  Field,
  HStack,
  Icon,
  Input,
  Menu,
  Popover,
  Portal,
  Stack,
  Tag,
  Text,
  useSlotRecipe,
} from "@chakra-ui/react";
import { useState } from "react";
import { ListRow } from "@/components/list-row/list-row";
import { getIconComponent } from "@/components/primitives/icon-options";
import { Tooltip } from "@/components/primitives/tooltip";

interface HarnessAction {
  id: string;
  label: string;
  icon?: string;
  argument?: { label: string; value?: string };
}
interface HarnessMode {
  id: string;
  label: string;
  description: string;
  state: string;
  indicator?: { label: string; tone: "neutral" | "info" | "success" | "warning" | "error" };
  tagText?: string;
  closeActionId?: string;
  confirmation?: { id: string; title: string; actionId: string; cancelLabel?: string };
  actions: HarnessAction[];
}
interface LocalTag {
  label: string;
  description: string;
  onClose: () => void;
  closeLabel?: string;
}
export interface HarnessControlsProps {
  modes: HarnessMode[];
  draftTag?: LocalTag;
  sentTag?: LocalTag;
  pending?: boolean;
  unavailable?: boolean;
  onRequestConfirmation?: (modeId: string) => void;
  onAction: (modeId: string, actionId: string, argument?: string, modeSnapshot?: HarnessMode) => Promise<void>;
}

const LocalModeTag = (props: { tag: LocalTag }) => {
  const { tag } = props;
  return (
    <Menu.Root>
      <Tooltip content={tag.description} openDelay={300} closeDelay={150}>
        <Tag.Root variant="ticket" size="composer">
          <Menu.Trigger asChild>
            <Tag.Label asChild>
              <button type="button" aria-label={tag.description}>
                {tag.label}
              </button>
            </Tag.Label>
          </Menu.Trigger>
          <Tag.CloseTrigger aria-label={tag.closeLabel ?? `Remove ${tag.label}`} onClick={tag.onClose} />
        </Tag.Root>
      </Tooltip>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Text p="sm" textStyle="label/S/regular" overflowWrap="anywhere">
              {tag.description}
            </Text>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

const NativeModeTag = (props: {
  mode: HarnessMode;
  pending?: boolean;
  unavailable?: boolean;
  onRequestConfirmation?: HarnessControlsProps["onRequestConfirmation"];
  onAction: HarnessControlsProps["onAction"];
}) => {
  const { mode, pending, unavailable, onRequestConfirmation, onAction } = props;
  const styles = useSlotRecipe({ key: "menu" })();
  const [editing, setEditing] = useState<{ action: HarnessAction; mode: HarnessMode } | null>(null);
  const [argument, setArgument] = useState("");
  const [open, setOpen] = useState(false);
  const closeAction = mode.actions.find((action) => action.id === mode.closeActionId && !action.argument);
  const invoke = async (action: HarnessAction, value?: string, modeSnapshot = mode) => {
    try {
      await onAction(mode.id, action.id, value, modeSnapshot);
      setEditing(null);
      setOpen(false);
      return true;
    } catch {
      /* The conversation owns operation errors. Keep the native tag until readback. */
      return false;
    }
  };
  let status = mode.state;
  if (pending) status = `Checking · Last confirmed: ${mode.state}`;
  if (unavailable) status = `Status unavailable · Last confirmed: ${mode.state}`;
  return (
    <Popover.Root
      open={open}
      positioning={{ placement: "top-start" }}
      onOpenChange={(details) => {
        setOpen(details.open);
        if (!details.open) setEditing(null);
      }}
    >
      <Tooltip content={`${mode.label}: ${mode.description} · ${status}`} openDelay={300} closeDelay={150}>
        <Tag.Root variant="ticket" size="composer">
          {mode.indicator ? (
            <Tag.StartElement>
              <chakra.span
                role="img"
                aria-label={unavailable ? "Status unavailable" : mode.indicator.label}
                data-status-dot=""
                data-tone={unavailable ? "neutral" : mode.indicator.tone}
              />
            </Tag.StartElement>
          ) : null}
          <Popover.Trigger asChild>
            <Tag.Label asChild>
              <button type="button" aria-label={`${mode.label} details`}>
                {mode.label}
              </button>
            </Tag.Label>
          </Popover.Trigger>
          {closeAction ? (
            <Tag.CloseTrigger
              aria-label={closeAction.label}
              disabled={pending || unavailable}
              onClick={() => void invoke(closeAction)}
            />
          ) : null}
        </Tag.Root>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content css={styles.content} aria-label={`${mode.label} details`}>
            <Stack p="sm" gap="xs">
              <Text textStyle="label/S/medium">{mode.label}</Text>
              <Text textStyle="label/S/regular" overflowWrap="anywhere">
                {mode.description}
              </Text>
              <Text textStyle="label/XS/regular" color="fg.muted">
                {status}
              </Text>
              {editing?.action.argument ? (
                <Field.Root>
                  <Field.Label>{editing.action.argument.label}</Field.Label>
                  <Input autoFocus size="sm" value={argument} onChange={(event) => setArgument(event.target.value)} />
                  <HStack>
                    <Button size="xs" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={pending || unavailable || !argument.trim()}
                      onClick={() => void invoke(editing.action, argument, editing.mode)}
                    >
                      Apply
                    </Button>
                  </HStack>
                </Field.Root>
              ) : null}
            </Stack>
            {!editing
              ? mode.actions.map((action) => (
                  <ListRow
                    key={action.id}
                    role="button"
                    variant="full-width"
                    label={action.label}
                    icon={action.icon ? <Icon as={getIconComponent(action.icon)} boxSize="icon-xs" /> : undefined}
                    disabled={
                      pending || unavailable || (action.id === mode.confirmation?.actionId && !onRequestConfirmation)
                    }
                    onActivate={() => {
                      if (action.id === mode.confirmation?.actionId) {
                        setOpen(false);
                        onRequestConfirmation?.(mode.id);
                      } else if (action.argument) {
                        setArgument(action.argument.value ?? "");
                        setEditing({ action, mode });
                      } else void invoke(action);
                    }}
                  />
                ))
              : null}
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

export const HarnessControls = (props: HarnessControlsProps) => {
  const { modes, draftTag, sentTag, pending, unavailable, onRequestConfirmation, onAction } = props;
  return (
    <HStack gap="2xs" minW="0" aria-label="Harness controls">
      {modes.map((mode) => (
        <NativeModeTag
          key={mode.id}
          mode={mode}
          pending={pending}
          unavailable={unavailable}
          onRequestConfirmation={onRequestConfirmation}
          onAction={onAction}
        />
      ))}
      {draftTag ? <LocalModeTag tag={draftTag} /> : null}
      {sentTag ? <LocalModeTag tag={sentTag} /> : null}
    </HStack>
  );
};
