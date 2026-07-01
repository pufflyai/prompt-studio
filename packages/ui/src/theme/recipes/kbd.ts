import { defineRecipe } from "@chakra-ui/react";

export const kbdRecipe = defineRecipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: "0",
    minW: "1.25rem",
    px: "1",
    borderRadius: "0",
    borderWidth: "0",
    borderStyle: "solid",
    fontFamily: "mono",
    fontWeight: "medium",
    lineHeight: "1",
    bg: "transparent",
    boxShadow: "none",
    userSelect: "none",
    whiteSpace: "nowrap",
    wordSpacing: "normal",
  },
  variants: {
    variant: {
      raised: {
        color: "fg.muted",
        bg: "transparent",
        borderWidth: "0",
        borderColor: "border.subtle",
        borderBottomWidth: "0",
        boxShadow: "none",
      },
      outline: {
        color: "fg.muted",
        bg: "transparent",
        borderWidth: "0",
        borderColor: "border.subtle",
      },
      subtle: {
        color: "fg",
        bg: "transparent",
        borderWidth: "0",
        borderColor: "border.subtle",
        boxShadow: "none",
      },
      plain: {
        color: "fg.muted",
        bg: "transparent",
        borderWidth: "0",
        borderColor: "transparent",
        minW: "auto",
        px: "0",
      },
    },
    size: {
      sm: {
        height: "1rem",
        textStyle: "label/XS/medium",
      },
      md: {
        height: "1.25rem",
        textStyle: "label/XS/medium",
      },
      lg: {
        height: "1.5rem",
        textStyle: "label/S/medium",
      },
    },
  },
  defaultVariants: {
    size: "md",
    variant: "raised",
  },
});
