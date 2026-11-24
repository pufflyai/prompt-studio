import { defineRecipe } from "@chakra-ui/react";

export const terminalSessionNoticeRecipe = defineRecipe({
  className: "terminal-session-notice",
  base: {
    position: "absolute",
    inset: "0",
    padding: "md",
    textStyle: "paragraph/M/regular",
    color: "fg",
    overflow: "auto",
    overflowWrap: "anywhere",
  },
  variants: {
    state: {
      pending: { pointerEvents: "none" },
      error: { pointerEvents: "auto" },
    },
  },
  defaultVariants: { state: "pending" },
});
