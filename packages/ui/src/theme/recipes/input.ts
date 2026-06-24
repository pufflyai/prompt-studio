import { defineRecipe } from "@chakra-ui/react";

export const inputRecipe = defineRecipe({
  base: {
    px: "sm",
    borderRadius: "xs",
    transition: "border-color 0.2s ease-in-out",
    bg: "bg",
    color: "fg",
    borderColor: "border.muted",
    _hover: { borderColor: "border" },
    _active: { borderColor: "blue.border" },
    _focus: { borderColor: "blue.border" },
    _focusVisible: { borderColor: "blue.border", outline: "none" },
    _placeholder: { color: "fg.subtle" },
  },
  variants: {
    size: {
      sm: {
        h: "2rem",
      },
    },
  },
});
