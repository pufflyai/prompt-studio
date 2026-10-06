import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
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
export const RestoresFocus: Story = { render: () => <DelayedEnableComposer /> };
