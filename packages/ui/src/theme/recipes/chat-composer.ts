import { defineSlotRecipe } from "@chakra-ui/react";

export const chatComposerRecipe = defineSlotRecipe({
  className: "ps-chat-composer",
  slots: ["root", "input", "workspace"],
  base: {
    root: { px: "xs", pb: "xs", pt: "0", gap: "0" },
    input: {
      position: "relative",
      width: "full",
      padding: "xs",
      bg: "bg",
      borderRadius: "xs",
      _focusWithin: { outline: "{borders.accent-light}", outlineOffset: "-1px" },
    },
    workspace: { display: "flex", flexDirection: "column", gap: "0" },
  },
  variants: {
    attachedToTop: {
      true: { input: { borderTopRadius: "0" } },
    },
    workspace: {
      true: {
        workspace: {
          padding: "2xs",
          borderRadius: "xs",
          bg: "bg.muted",
        },
      },
    },
  },
});
