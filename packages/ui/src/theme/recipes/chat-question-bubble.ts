import { defineRecipe } from "@chakra-ui/react";

export const chatQuestionBubbleRecipe = defineRecipe({
  base: {
    display: "flex",
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
    "& [data-question-answer]": { color: "fg.muted", fontWeight: "medium" },
    "& svg": { width: "3", height: "3", flexShrink: 0, color: "fg.muted" },
    "&[data-state=answered]": {
      cursor: "default",
      _hover: { bg: "bg.subtle" },
      "& [data-question-answer]": { color: "fg" },
    },
  },
});
