interface ChatInputActionState {
  canInterrupt: boolean;
  isDisabled: boolean;
  streaming: boolean;
  hasText: boolean;
}

export type ChatInputAction = "interrupt" | "none" | "submit";

export const resolveChatInputKeyboardAction = (state: ChatInputActionState): ChatInputAction => {
  const { isDisabled, streaming, hasText } = state;
  if (isDisabled || streaming || !hasText) return "none";
  return "submit";
};

export const resolveChatInputButtonAction = (state: ChatInputActionState): ChatInputAction => {
  const { canInterrupt, isDisabled, streaming, hasText } = state;
  if (isDisabled) return "none";
  if (streaming) return canInterrupt ? "interrupt" : "none";
  if (!hasText) return "none";
  return "submit";
};
