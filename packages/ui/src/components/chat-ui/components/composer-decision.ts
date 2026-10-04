import type { ReactNode } from "react";
import type { ChatInputQuestionResponse } from "./chat-input-question-prompt";

/** A native decision occupies the composer without submitting the saved draft. */
export interface ComposerDecision {
  id: string;
  controls?: ReactNode;
  model?: string;
  pending?: boolean;
  actions: { id: string; label: string; variant: "primary" | "subtle" | "ghost"; disabled?: boolean }[];
  onAction: (actionId: string) => void | Promise<void>;
}

interface ComposerResponseInput {
  response?: ChatInputQuestionResponse;
  text: string;
  attachments: string[];
  onSubmit: (text: string, attachments: string[], response?: ChatInputQuestionResponse) => void | Promise<void>;
  onClearAttachments?: () => void;
}

export const submitComposerResponse = async (input: ComposerResponseInput) => {
  await input.onSubmit(input.text, input.response ? [] : input.attachments, input.response);
  if (!input.response) input.onClearAttachments?.();
};
