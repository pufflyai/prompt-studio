interface ChatInputActionState {
  canInterrupt: boolean;
  /** False while the runtime cannot accept a message, for example without a model. */
  canSubmit: boolean;
  hasQuestionPrompt: boolean;
  isDisabled: boolean;
  streaming: boolean;
  text: string;
}

export type ChatInputAction = "interrupt" | "none" | "submit";

const hasMessageText = (text: string) => text.trim().length > 0;

export const resolveChatInputKeyboardAction = (state: ChatInputActionState): ChatInputAction => {
  const { canSubmit, isDisabled, text } = state;
  if (isDisabled || !canSubmit || !hasMessageText(text)) return "none";
  return "submit";
};

export const resolveChatInputButtonAction = (state: ChatInputActionState): ChatInputAction => {
  const { canInterrupt, canSubmit, hasQuestionPrompt, isDisabled, streaming, text } = state;
  if (isDisabled) return "none";
  if (canSubmit && hasMessageText(text)) return "submit";
  if (streaming && !hasQuestionPrompt) return canInterrupt ? "interrupt" : "none";
  return "none";
};
