import { defineSlotRecipe } from "@chakra-ui/react";

export const chatComposerRecipe = defineSlotRecipe({
  className: "ps-chat-composer",
  slots: ["input", "workspace"],
  base: {
    input: {
      position: "relative",
      width: "full",
      padding: "xs",
      bg: "bg",
      borderRadius: "xs",
    },
    workspace: { gap: "0" },
  },
  variants: {
    attachedToTop: {
      true: { input: { borderTopRadius: "0" } },
    },
    workspace: {
      true: {
        workspace: {
          gap: "2xs",
          padding: "2xs",
          borderRadius: "xs",
          bg: "bg.muted",
        },
      },
    },
  },
});
