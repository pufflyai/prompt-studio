import { Button, HStack, Input, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatInput } from "./chat-input";

const LOCK_MS = 400;
// The host locks the composer for a moment: after a send, while it starts up, or while it loads a request.
const DelayedEnableComposer = (props: { autoFocus?: boolean; lockedOnMount?: boolean }) => {
  const { autoFocus = false, lockedOnMount = false } = props;
  const [disabled, setDisabled] = useState(lockedOnMount);
  const [focusSignal, setFocusSignal] = useState(0);
  const lockBriefly = () => {
    setDisabled(true);
    setTimeout(() => setDisabled(false), LOCK_MS);
  };
  return (
    <Stack w="32rem" gap="xs">
      <ChatInput
        defaultState={createSerializedPromptState("")}
        isDisabled={disabled}
        autoFocus={autoFocus}
        focusSignal={focusSignal}
        onSubmit={lockBriefly}
      />
      <HStack gap="xs">
        <Button size="xs" variant="outline" onClick={() => setDisabled(false)}>
          Unlock
        </Button>
        <Button
          size="xs"
          variant="outline"
          onClick={() => {
            lockBriefly();
            setFocusSignal((signal) => signal + 1);
          }}
        >
          Load request
        </Button>
        <Input size="xs" aria-label="Notes" />
      </HStack>
    </Stack>
  );
};
const meta: CanvasMeta<typeof DelayedEnableComposer> = {
  title: "Patterns/Chat/Chat Input/Delayed enable",
  component: DelayedEnableComposer,
};
export default meta;
type Story = CanvasFrame<typeof DelayedEnableComposer>;
export const RestoresFocus: Story = {
  id: "patterns-chat-chat-input-delayed-enable--restores-focus",
  render: () => <DelayedEnableComposer />,
};
// Each focus request below arrives while the editor is still locked, so it must wait for the editor.
export const AutoFocusWhenUnlocked: Story = {
  id: "patterns-chat-chat-input-delayed-enable--auto-focus-when-unlocked",
  render: () => <DelayedEnableComposer autoFocus lockedOnMount />,
};
export const FocusSignalWhenUnlocked: Story = {
  id: "patterns-chat-chat-input-delayed-enable--focus-signal-when-unlocked",
  render: () => <DelayedEnableComposer />,
};
export const KeepsFocusInAnotherField: Story = {
  id: "patterns-chat-chat-input-delayed-enable--keeps-focus-in-another-field",
  render: () => <DelayedEnableComposer />,
};
