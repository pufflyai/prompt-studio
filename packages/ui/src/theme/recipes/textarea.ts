import { defineRecipe } from "@chakra-ui/react";

export const textareaRecipe = defineRecipe({
  base: {
    paddingX: "sm",
    paddingY: "xs",
    opacity: "1",
    outline: "none",
    color: "fg",
    border: "1px solid",
    borderRadius: "xs",
    transition: "border-color 0.2s ease-in-out",
    borderColor: "border.muted",
    _hover: {
      borderColor: "border",
    },
    _active: {
      borderColor: "blue.border",
    },
    _focus: {
      borderColor: "blue.border",
    },
    _focusVisible: {
      borderColor: "blue.border",
    },
    _placeholder: {
      color: "fg.subtle",
    },
  },
});
