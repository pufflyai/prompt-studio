import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatInput } from "./chat-input";

const StreamingComposer = (props: { fail?: boolean; slow?: boolean; question?: boolean }) => {
  const { fail, slow, question } = props;
  const [messages, setMessages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(true);
  const [pending, setPending] = useState(false);
  return (
    <Box w="full">
      <ChatInput
        defaultState={createSerializedPromptState("Seeded draft")}
        questionPrompt={
          question
            ? {
                questions: [
                  {
                    id: "language",
                    question: "Choose a language",
                    multiple: true,
                    allowCustomAnswer: true,
                    options: [{ label: "TypeScript" }],
                  },
                ],
              }
            : undefined
        }
        streaming={streaming}
        onInterrupt={() => setStreaming(false)}
        onSubmit={async (text) => {
          setPending(true);
          if (!fail) setMessages((current) => [...current, text]);
          if (slow) await new Promise((resolve) => setTimeout(resolve, 1000));
          setPending(false);
          if (fail) throw new Error("Submission failed");
        }}
      />
      <Text>{pending ? "Sending" : "Ready"}</Text>
      <Text>{streaming ? "Current turn is running" : "Response stopped"}</Text>
      {messages.map((message, index) => (
        <Text key={`${index}-${message}`}>Waiting: {message}</Text>
      ))}
    </Box>
  );
};
const meta = { title: "Patterns/Chat/Follow-up submission", component: StreamingComposer } satisfies Meta<
  typeof StreamingComposer
>;
export default meta;
export const QueueWhileRunning: StoryObj<typeof meta> = {};
export const KeepFailedDraft: StoryObj<typeof meta> = {
  tags: ["!manifest"],
  args: { fail: true, slow: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = () => canvas.getByTestId("content-editable");
    await userEvent.click(canvas.getByTestId("send-message-button"));
    await waitFor(() => expect(canvas.getByText("Sending")).toBeVisible());
    await expect(editor().textContent).toBe("");
    await expect(editor()).toHaveAttribute("contenteditable", "false");
    await waitFor(() => expect(canvas.getByText("Ready")).toBeVisible());
    await expect(editor()).toHaveTextContent("Seeded draft");
    await expect(editor()).toHaveAttribute("contenteditable", "true");
    await waitFor(() => expect(editor()).toHaveFocus());
  },
};
export const SlowSubmission: StoryObj<typeof meta> = {
  tags: ["!manifest"],
  args: { slow: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = () => canvas.getByTestId("content-editable");
    const send = canvas.getByTestId("send-message-button");
    await userEvent.click(editor());
    await fireEvent.keyDown(editor(), { key: "Enter", code: "Enter" });
    await waitFor(() => expect(canvas.getByText("Sending")).toBeVisible());
    await expect(canvas.getByText("Waiting: Seeded draft")).toBeVisible();
    await expect(editor().textContent).toBe("");
    await expect(editor()).toHaveAttribute("contenteditable", "false");
    await expect(send).toBeDisabled();
    await waitFor(() => expect(canvas.getByText("Ready")).toBeVisible());
    await expect(editor().textContent).toBe("");
    await waitFor(() => expect(editor()).toHaveFocus());
  },
};

export const KeepFailedQuestionAnswers: StoryObj<typeof meta> = {
  tags: ["!manifest"],
  args: { fail: true, slow: true, question: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole("checkbox", { name: "TypeScript" });
    const other = canvas.getByRole("checkbox", { name: "Other" });
    const custom = () => canvas.getByRole("textbox", { name: "Choose a language (Other)" });
    await userEvent.click(option);
    await userEvent.click(other);
    await userEvent.type(custom(), "Another language");
    await userEvent.click(canvas.getByTestId("send-message-button"));
    await waitFor(() => expect(canvas.getByText("Sending")).toBeVisible());
    await expect(option).not.toBeChecked();
    await expect(other).not.toBeChecked();
    await expect(canvas.queryByRole("textbox", { name: "Choose a language (Other)" })).not.toBeInTheDocument();
    await expect(option.closest("label")).toHaveAttribute("aria-readonly", "true");
    await userEvent.click(option);
    await expect(option).not.toBeChecked();
    await waitFor(() => expect(canvas.getByText("Ready")).toBeVisible());
    await waitFor(() => expect(option).toBeChecked());
    await expect(other).toBeChecked();
    await expect(custom()).toHaveValue("Another language");
    await expect(canvas.getByTestId("content-editable")).toHaveTextContent("Seeded draft");
  },
};
