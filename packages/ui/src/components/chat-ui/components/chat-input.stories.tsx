import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useState } from "react";
import { AttachmentList } from "./attachment-list";
import { ChatInput } from "./chat-input";
import type { ChatInputQuestionPrompt } from "./chat-input-question-prompt";

const meta: Meta<typeof ChatInput> = {
  title: "Patterns/Chat/Chat Input",
  component: ChatInput,
  parameters: {
    layout: "centered",
    actions: { argTypesRegex: "^on(?!Change)[A-Z].*" },
  },
};
export default meta;

type Story = StoryObj<typeof ChatInput>;
type ChatInputProps = ComponentProps<typeof ChatInput>;

const initialState = JSON.stringify(
  {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text: "",
              type: "text",
              version: 1,
            },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  },
  null,
  2,
);

export const Default: Story = {
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

function WithAttachmentsRenderer(props: ChatInputProps) {
  const { attachedResources: initialAttachedResources = [], onClearAttachments, ...rest } = props;
  const [attachedResources, setAttachedResources] = useState<string[]>(initialAttachedResources);

  const attachmentList = (
    <AttachmentList
      attachments={attachedResources}
      onSelect={(resourceId) => console.log("Selected:", resourceId)}
      onRemove={(resourceId) => {
        setAttachedResources((prev) => prev.filter((id) => id !== resourceId));
      }}
    />
  );

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

export const QuestionFreeform: Story = {
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
  args: {
    defaultState: initialState,
    questionPrompt: multiStepQuestionPrompt,
    onSubmit: (text: string) => {
      console.log("Submitted response:", text);
      alert(`Submitted response: ${text}`);
    },
  },
};
