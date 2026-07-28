interface ChatInputActionState {
  canInterrupt: boolean;
  hasQuestionPrompt: boolean;
  isDisabled: boolean;
  streaming: boolean;
  text: string;
}

export type ChatInputAction = "interrupt" | "none" | "submit";

const hasMessageText = (text: string) => text.trim().length > 0;

export const resolveChatInputKeyboardAction = (state: ChatInputActionState): ChatInputAction => {
  const { hasQuestionPrompt, isDisabled, streaming, text } = state;
  if (isDisabled || (streaming && !hasQuestionPrompt) || !hasMessageText(text)) return "none";
  return "submit";
};

export const resolveChatInputButtonAction = (state: ChatInputActionState): ChatInputAction => {
  const { canInterrupt, hasQuestionPrompt, isDisabled, streaming, text } = state;
  if (isDisabled) return "none";
  if (streaming && !hasQuestionPrompt) return canInterrupt ? "interrupt" : "none";
  if (!hasMessageText(text)) return "none";
  return "submit";
};
