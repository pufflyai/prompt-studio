interface ChatInputActionState {
  canInterrupt: boolean;
  isDisabled: boolean;
  streaming: boolean;
  text: string;
}

export type ChatInputAction = "interrupt" | "none" | "submit";

const hasMessageText = (text: string) => text.trim().length > 0;

export const resolveChatInputKeyboardAction = (state: ChatInputActionState): ChatInputAction => {
  const { isDisabled, streaming, text } = state;
  if (isDisabled || streaming || !hasMessageText(text)) return "none";
  return "submit";
};

export const resolveChatInputButtonAction = (state: ChatInputActionState): ChatInputAction => {
  const { canInterrupt, isDisabled, streaming, text } = state;
  if (isDisabled) return "none";
  if (streaming) return canInterrupt ? "interrupt" : "none";
  if (!hasMessageText(text)) return "none";
  return "submit";
};
