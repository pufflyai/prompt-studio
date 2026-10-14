import { Button, HStack, Input, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
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
const meta: Meta<typeof DelayedEnableComposer> = {
  title: "Patterns/Chat/Chat Input/Delayed enable",
  component: DelayedEnableComposer,
};
export default meta;
type Story = StoryObj<typeof DelayedEnableComposer>;
export const RestoresFocus: Story = {
  render: () => <DelayedEnableComposer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = () => canvas.getByTestId("content-editable");
    await userEvent.click(editor());
    await userEvent.type(editor(), "Follow-up message");
    await fireEvent.keyDown(editor(), { key: "Enter", code: "Enter" });
    await waitFor(() => expect(editor()).toHaveAttribute("contenteditable", "false"));
    await expect(canvas.getByTestId("send-message-button")).toBeDisabled();
    await waitFor(() => expect(editor()).toHaveAttribute("contenteditable", "true"));
    await waitFor(() => expect(editor()).toHaveFocus());
  },
};

// Each focus request below arrives while the editor is still locked, so it must wait for the editor.
export const AutoFocusWhenUnlocked: Story = {
  render: () => <DelayedEnableComposer autoFocus lockedOnMount />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = () => canvas.getByTestId("content-editable");
    await expect(editor()).toHaveAttribute("contenteditable", "false");
    await userEvent.click(canvas.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(editor()).toHaveAttribute("contenteditable", "true"));
    await waitFor(() => expect(editor()).toHaveFocus());
  },
};

export const FocusSignalWhenUnlocked: Story = {
  render: () => <DelayedEnableComposer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = () => canvas.getByTestId("content-editable");
    await userEvent.click(canvas.getByRole("button", { name: "Load request" }));
    await expect(editor()).toHaveAttribute("contenteditable", "false");
    await waitFor(() => expect(editor()).toHaveAttribute("contenteditable", "true"));
    await waitFor(() => expect(editor()).toHaveFocus());
  },
};

export const KeepsFocusInAnotherField: Story = {
  render: () => <DelayedEnableComposer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = () => canvas.getByTestId("content-editable");
    const notes = canvas.getByRole("textbox", { name: "Notes" });
    await userEvent.click(editor());
    await userEvent.type(editor(), "Follow-up message");
    await fireEvent.keyDown(editor(), { key: "Enter", code: "Enter" });
    await waitFor(() => expect(editor()).toHaveAttribute("contenteditable", "false"));
    await userEvent.type(notes, "Remember the tests");
    await waitFor(() => expect(editor()).toHaveAttribute("contenteditable", "true"));
    // Give a late focus handoff two frames to show up before checking that nothing moved.
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    await expect(notes).toHaveFocus();
    await expect(notes).toHaveValue("Remember the tests");
  },
};
