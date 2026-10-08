import { defineRecipe } from "@chakra-ui/react";

export const chatQuestionBubbleRecipe = defineRecipe({
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "xs",
    px: "sm",
    py: "xs",
    width: "fit-content",
    maxWidth: "full",
    textAlign: "left",
    textStyle: "label/S/regular",
    borderRadius: "xs",
    border: "border",
    borderColor: "border",
    color: "fg",
    bg: "bg.subtle",
    cursor: "pointer",
    _hover: { bg: "bg.hover" },
    _expanded: { bg: "bg.active", borderColor: "border.accent" },
    _focusVisible: { outline: "2px solid {colors.border.accent}", outlineOffset: "2px" },
    "& [data-question-text]": { minWidth: "0", maxWidth: "full", whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
    "& [data-question-answer-row]": { display: "flex", alignItems: "center", gap: "xs", maxWidth: "full" },
    "& [data-question-answer]": { color: "fg.muted", fontWeight: "medium", overflowWrap: "anywhere", minWidth: "0" },
    "& svg": { width: "3", height: "3", flexShrink: 0, color: "fg.muted" },
    "&[data-state=answered]": {
      cursor: "default",
      _hover: { bg: "bg.subtle" },
      "& [data-question-answer]": { color: "fg" },
    },
  },
  variants: {
    multiline: {
      true: { flexDirection: "column", alignItems: "start" },
    },
  },
});
