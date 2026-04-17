export type SendAction = "interrupt" | "submit" | "blocked";

export const resolveSendAction = (input: {
  isDisabled: boolean;
  canInterrupt: boolean;
  streaming: boolean;
  hasText: boolean;
}): SendAction => {
  if (input.isDisabled) return "blocked";
  if (input.canInterrupt) return "interrupt";
  if (input.streaming) return "blocked";
  if (!input.hasText) return "blocked";
  return "submit";
};
