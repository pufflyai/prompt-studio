import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { type ComponentProps, useState } from "react";
import { createSerializedPromptState } from "../utils/editor-state";
import { AttachmentList } from "./attachment-list";
import { ChatInput } from "./chat-input";
import type { ChatInputQuestionPrompt } from "./chat-input-question-prompt";

const meta: CanvasMeta<typeof ChatInput> = {
  title: "Patterns/Chat/Chat Input",
  component: ChatInput,
};
export default meta;
type Story = CanvasFrame<typeof ChatInput>;
type ChatInputProps = ComponentProps<typeof ChatInput>;
const initialState = createSerializedPromptState("");
export const Default: Story = {
  id: "patterns-chat-chat-input--default",
  args: {
    defaultState: initialState,
    placeholder: "Ask me something...",
    onSubmit: (text: string, attachments: string[]) => {
      console.log("Submitted text:", text);
      if (attachments.length > 0) {
        console.log("Submitted attachments:", attachments);
      }
      alert(`Submitted: ${text}${attachments.length > 0 ? ` with ${attachments.length} attachments` : ""}`);
    },
  },
};
export const Streaming: Story = {
  id: "patterns-chat-chat-input--streaming",
  render: (args) => (
    <Box w="32rem">
      <ChatInput {...args} />
    </Box>
  ),
  args: {
    defaultState: initialState,
    placeholder: "Generating response...",
    streaming: true,
    onInterrupt: () => console.log("Interrupted"),
  },
};
export const Selected: Story = {
  id: "patterns-chat-chat-input--selected",
  render: (args) => (
    <Box w="32rem">
      <ChatInput {...args} />
    </Box>
  ),
  args: {
    defaultState: initialState,
    placeholder: "Ask me something...",
    autoFocus: true,
    onSubmit: (text: string) => {
      console.log("Submitted text:", text);
      alert(`Submitted: ${text}`);
    },
  },
};
function WithAttachmentsRenderer(props: ChatInputProps) {
  const { attachedResources: initialAttachedResources = [], onClearAttachments, ...rest } = props;
  const [attachedResources, setAttachedResources] = useState<string[]>(initialAttachedResources);
  const attachmentList =
    attachedResources.length > 0 ? (
      <AttachmentList
        attachments={attachedResources}
        onSelect={(resourceId) => console.log("Selected:", resourceId)}
        onRemove={(resourceId) => {
          setAttachedResources((prev) => prev.filter((id) => id !== resourceId));
        }}
      />
    ) : undefined;
  return (
    <ChatInput
      {...rest}
      attachedResources={attachedResources}
      attachmentList={attachmentList}
      onClearAttachments={() => {
        setAttachedResources([]);
        onClearAttachments?.();
      }}
    />
  );
}
export const WithAttachments: Story = {
  id: "patterns-chat-chat-input--with-attachments",
  render: (args) => {
    const rendererArgs: ChatInputProps = {
      ...(args ?? {}),
      defaultState: args?.defaultState ?? initialState,
      attachedResources: args?.attachedResources ?? [],
    };
    return <WithAttachmentsRenderer {...rendererArgs} />;
  },
  args: {
    defaultState: initialState,
    placeholder: "Summarize the attached files...",
    attachedResources: ["workspace/customer-data.csv", "workspace/analysis-report.md"],
    onSubmit: (text: string, attachments: string[]) => {
      console.log("Submitted text:", text);
      console.log("Submitted attachments:", attachments);
      alert(`Submitted: ${text}${attachments.length > 0 ? ` with ${attachments.length} attachments` : ""}`);
    },
  },
};
export const EmptyAttachmentTray: Story = {
  id: "patterns-chat-chat-input--empty-attachment-tray",
  render: (args) => {
    const rendererArgs: ChatInputProps = {
      ...(args ?? {}),
      defaultState: args?.defaultState ?? initialState,
      attachedResources: [],
    };
    return <WithAttachmentsRenderer {...rendererArgs} />;
  },
  args: {
    defaultState: initialState,
    placeholder: "Attach files when needed...",
  },
};
const singleChoiceQuestionPrompt: ChatInputQuestionPrompt = {
  questions: [
    {
      id: "language",
      question: "Which language do you want to use?",
      options: [{ label: "TypeScript" }, { label: "Python" }, { label: "Go" }],
      multiple: false,
      required: true,
    },
  ],
};
const multiChoiceQuestionPrompt: ChatInputQuestionPrompt = {
  questions: [
    {
      id: "focus",
      question: "What should the plan prioritize?",
      options: [
        { label: "Performance", description: "runtime and build time" },
        { label: "Reliability", description: "tests and retries" },
        { label: "Maintainability", description: "readability and structure" },
      ],
      multiple: true,
      required: true,
    },
  ],
};
const customQuestionPrompt: ChatInputQuestionPrompt = {
  questions: [
    {
      id: "constraints",
      question: "Select constraints and add custom notes if needed.",
      options: [{ label: "No backend changes" }, { label: "Keep API stable" }, { label: "Ship today" }],
      multiple: true,
      allowCustomAnswer: true,
    },
  ],
};
// Mirrors the shape Claude Code's own client shows: listed options plus an "Other" choice that
// opens a text box, and a way out of the question entirely.
const greetingQuestionPrompt: ChatInputQuestionPrompt = {
  questions: [
    {
      id: "greeting",
      question: "Which greeting should I use?",
      options: [
        { label: "Hello", description: 'Use "Hello" as the greeting.' },
        { label: "Hi", description: 'Use "Hi" as the greeting.' },
      ],
      required: true,
      allowCustomAnswer: true,
    },
  ],
};
const freeformQuestionPrompt: ChatInputQuestionPrompt = {
  questions: [
    {
      id: "details",
      question: "What should I know before continuing?",
      options: [],
      required: true,
      allowCustomAnswer: true,
    },
  ],
};
const multiStepQuestionPrompt: ChatInputQuestionPrompt = {
  questions: [
    {
      id: "goal",
      question: "What should be built?",
      options: [],
      required: true,
      allowCustomAnswer: true,
    },
    {
      id: "constraints",
      question: "Select constraints.",
      options: [{ label: "Keep API stable" }, { label: "No backend changes" }, { label: "Add tests" }],
      multiple: true,
      required: true,
    },
    {
      id: "notes",
      question: "Anything else?",
      options: [],
      allowCustomAnswer: true,
    },
  ],
};
export const QuestionSingleChoice: Story = {
  id: "patterns-chat-chat-input--question-single-choice",
  args: {
    defaultState: initialState,
    placeholder: "Add context if needed...",
    questionPrompt: singleChoiceQuestionPrompt,
    onSubmit: (text: string) => {
      console.log("Submitted response:", text);
      alert(`Submitted response: ${text}`);
    },
  },
};
export const QuestionMultipleChoice: Story = {
  id: "patterns-chat-chat-input--question-multiple-choice",
  args: {
    defaultState: initialState,
    placeholder: "Optional details...",
    questionPrompt: multiChoiceQuestionPrompt,
    onSubmit: (text: string) => {
      console.log("Submitted response:", text);
      alert(`Submitted response: ${text}`);
    },
  },
};
export const QuestionWithCustomAnswer: Story = {
  id: "patterns-chat-chat-input--question-with-custom-answer",
  args: {
    defaultState: initialState,
    placeholder: "Add a custom answer...",
    questionPrompt: customQuestionPrompt,
    onSubmit: (text: string) => {
      console.log("Submitted response:", text);
      alert(`Submitted response: ${text}`);
    },
  },
};
export const QuestionSingleChoiceWithOther: Story = {
  id: "patterns-chat-chat-input--question-single-choice-with-other",
  args: {
    defaultState: initialState,
    questionPrompt: greetingQuestionPrompt,
    onSubmit: (text: string, _resources: unknown, questionResponse: unknown) => {
      // A single choice answers with one value, whether it was listed or typed under "Other".
      // Skip sends no entries at all.
      console.log("Submitted response:", text, questionResponse);
      alert(`${text}\n\n${JSON.stringify(questionResponse)}`);
    },
  },
};
export const QuestionFreeform: Story = {
  id: "patterns-chat-chat-input--question-freeform",
  args: {
    defaultState: initialState,
    placeholder: "Answer the question...",
    questionPrompt: freeformQuestionPrompt,
    onSubmit: (text: string) => {
      console.log("Submitted response:", text);
      alert(`Submitted response: ${text}`);
    },
  },
};
export const QuestionMultiStep: Story = {
  id: "patterns-chat-chat-input--question-multi-step",
  args: {
    defaultState: initialState,
    questionPrompt: multiStepQuestionPrompt,
    onSubmit: (text: string) => {
      console.log("Submitted response:", text);
      alert(`Submitted response: ${text}`);
    },
  },
};
const ControlledHistoryInput = (props: ChatInputProps) => {
  const [draft, setDraft] = useState(props.defaultState);
  return (
    <Box w="32rem">
      <ChatInput {...props} defaultState={draft} onChange={(text) => setDraft(createSerializedPromptState(text))} />
    </Box>
  );
};
export const PromptHistory: Story = {
  id: "patterns-chat-chat-input--prompt-history",
  render: (args) => <ControlledHistoryInput {...args} />,
  args: {
    defaultState: initialState,
    recentUserMessages: ["Summarize the plan", "Show the next steps", "Explain the project"],
    onSelectionChange: () => {},
    onEditorStateChange: () => {},
  },
};
export const PromptHistoryFull: Story = {
  id: "patterns-chat-chat-input--prompt-history-full",
  render: PromptHistory.render,
  args: { ...PromptHistory.args, recentUserMessages: Array.from({ length: 12 }, (_, i) => `Prompt ${12 - i}`) },
};
export const PromptHistoryMultiline: Story = {
  id: "patterns-chat-chat-input--prompt-history-multiline",
  render: PromptHistory.render,
  args: { ...PromptHistory.args, recentUserMessages: ["First line\nSecond line", "Earlier prompt"] },
};
export const PromptHistoryDraft: Story = {
  id: "patterns-chat-chat-input--prompt-history-draft",
  render: PromptHistory.render,
  args: PromptHistory.args,
};
export const PromptHistoryStreaming: Story = {
  id: "patterns-chat-chat-input--prompt-history-streaming",
  render: PromptHistory.render,
  args: { ...PromptHistory.args, streaming: true },
};
