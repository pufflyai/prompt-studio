import {
  type ChatInputQuestionPrompt,
  type ChatInputQuestionResponse,
  toQuestionResponse,
} from "./chat-input-question-prompt";

/** A host decision uses the question form without replying to a native tool request. */
export interface ComposerDecision {
  prompt: ChatInputQuestionPrompt;
  pending?: boolean;
  canRespond?: (response: ChatInputQuestionResponse) => boolean;
  onRespond: (response: ChatInputQuestionResponse) => void | Promise<void>;
}
export const resolveComposerDecision = (
  agentQuestionPrompt: ChatInputQuestionPrompt | undefined,
  decision: ComposerDecision | undefined,
) => {
  const activeDecision = agentQuestionPrompt ? undefined : decision;
  return { activeDecision, questionPrompt: agentQuestionPrompt ?? activeDecision?.prompt };
};
export const composerQuestionResponse = (prompt: ChatInputQuestionPrompt | undefined, answers: string[][]) =>
  prompt ? toQuestionResponse(prompt, answers) : undefined;

interface ComposerResponseInput {
  decision?: ComposerDecision;
  response?: ChatInputQuestionResponse;
  text: string;
  attachments: string[];
  onSubmit: (text: string, attachments: string[], response?: ChatInputQuestionResponse) => void | Promise<void>;
  onClearAttachments?: () => void;
}

export const canSubmitComposerResponse = (
  disabled: boolean,
  decision: ComposerDecision | undefined,
  response: ChatInputQuestionResponse | undefined,
) => !disabled && (!response || decision?.canRespond?.(response) !== false);

export const submitComposerResponse = async (input: ComposerResponseInput) => {
  if (input.decision && input.response) await input.decision.onRespond(input.response);
  else {
    await input.onSubmit(input.text, input.attachments, input.response);
    input.onClearAttachments?.();
  }
};
