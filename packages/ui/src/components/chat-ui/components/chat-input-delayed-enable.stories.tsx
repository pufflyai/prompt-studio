import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatInput } from "./chat-input";

const DelayedEnableComposer = () => {
  const [disabled, setDisabled] = useState(false);
  return (
    <Box w="32rem">
      <ChatInput
        defaultState={createSerializedPromptState("")}
        isDisabled={disabled}
        onSubmit={() => {
          setDisabled(true);
          setTimeout(() => setDisabled(false), 200);
        }}
      />
    </Box>
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
