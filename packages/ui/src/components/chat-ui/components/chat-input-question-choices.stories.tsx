import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatInput } from "./chat-input";
import type { ChatInputQuestionPrompt } from "./chat-input-question-prompt";

const single: ChatInputQuestionPrompt = {
  questions: [
    {
      id: "language",
      question: "Which language do you want to use?",
      options: [{ label: "TypeScript" }, { label: "Python" }],
      required: true,
      allowCustomAnswer: true,
    },
  ],
};

const meta: Meta<typeof ChatInput> = {
  title: "Patterns/Chat/Chat Input/Question Choices",
  component: ChatInput,
  parameters: { layout: "centered" },
  tags: ["question-choices"],
  render: (args) => (
    <Box w="xl">
      <ChatInput {...args} />
    </Box>
  ),
  args: { defaultState: createSerializedPromptState(""), questionPrompt: single, onSubmit: fn() },
};
export default meta;
type Story = StoryObj<typeof ChatInput>;

export const SingleChoiceOther: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("TypeScript", { exact: true }));
    await userEvent.click(canvas.getByText("Other", { exact: true }));
    await expect(canvas.getByTestId("send-message-button")).toBeDisabled();
    await userEvent.type(canvas.getByPlaceholderText("Other..."), "Rust");
    await userEvent.keyboard("{ArrowLeft}{ArrowUp}{ArrowDown}{ArrowRight}");
    await expect(canvas.getByPlaceholderText("Other...")).toHaveValue("Rust");
    await expect(canvas.getByRole("radio", { name: "Other", exact: true })).toBeChecked();
    await expect(canvas.getByRole("radio", { name: "TypeScript", exact: true })).not.toBeChecked();
    await expect(canvas.getByTestId("send-message-button")).toBeEnabled();
  },
};

export const SingleChoiceListedOption: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Other", { exact: true }));
    await userEvent.type(canvas.getByPlaceholderText("Other..."), "Rust");
    await userEvent.click(canvas.getByText("TypeScript", { exact: true }));
    await expect(canvas.queryByPlaceholderText("Other...")).not.toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "TypeScript", exact: true })).toBeChecked();
    await userEvent.click(canvas.getByText("Other", { exact: true }));
    await expect(canvas.getByPlaceholderText("Other...")).toHaveValue("");
    await userEvent.click(canvas.getByText("TypeScript", { exact: true }));
  },
};

export const MultipleChoiceOtherAndOption: Story = {
  args: { questionPrompt: { questions: [{ ...single.questions[0], multiple: true }] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("TypeScript", { exact: true }));
    await userEvent.type(canvas.getByPlaceholderText("Other..."), "Rust");
    await expect(canvas.getByRole("checkbox", { name: "TypeScript", exact: true })).toBeChecked();
    await expect(canvas.getByPlaceholderText("Other...")).toHaveValue("Rust");
    await expect(canvas.queryByRole("radio")).not.toBeInTheDocument();
  },
};

const requiredQuestions: ChatInputQuestionPrompt = {
  questions: [
    single.questions[0],
    { id: "notes", question: "Anything else?", options: [], required: true, allowCustomAnswer: true },
  ],
};

export const FreeformAnswer: Story = {
  args: { questionPrompt: { questions: [requiredQuestions.questions[1]] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Answer", { exact: true })).toBeInTheDocument();
    await userEvent.type(canvas.getByPlaceholderText("Answer..."), "Use plain language");
    await expect(canvas.getByTestId("send-message-button")).toBeEnabled();
  },
};

export const SkipControl: Story = {
  args: { questionPrompt: requiredQuestions },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Skip", exact: true })).toBeEnabled();
    await expect(canvas.getByTestId("send-message-button")).toBeDisabled();
  },
};

export const SkipSubmission: Story = {
  tags: ["!manifest"],
  args: { questionPrompt: requiredQuestions, onSubmit: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Skip", exact: true }));
    await expect(args.onSubmit).toHaveBeenCalledWith(
      "Which language do you want to use?: You decide\nAnything else?: You decide",
      [],
      { answers: [["You decide"], ["You decide"]] },
    );
  },
};
