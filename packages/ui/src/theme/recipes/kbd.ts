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
    borderWidth: "1px",
    borderStyle: "solid",
    fontFamily: "mono",
    fontWeight: "medium",
    lineHeight: "1",
    userSelect: "none",
    whiteSpace: "nowrap",
    wordSpacing: "normal",
  },
  variants: {
    variant: {
      raised: {
        color: "fg.muted",
        bg: "bg.subtle",
        borderColor: "border.muted",
        borderBottomWidth: "2px",
      },
      outline: {
        color: "fg.muted",
        bg: "transparent",
        borderColor: "border.muted",
      },
      subtle: {
        color: "fg",
        bg: "bg.muted",
        borderColor: "border.subtle",
      },
      plain: {
        color: "fg.muted",
        bg: "transparent",
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
