import { defineSlotRecipe } from "@chakra-ui/react";

export const stickyUserMessageRecipe = defineSlotRecipe({
  slots: ["root", "viewport", "body", "preview", "footer", "actions"],
  base: {
    actions: { px: "xs", pb: "xs" },
    root: { position: "relative", padding: "0", overflow: "hidden" },
    viewport: { maxHeight: "chat-user-preview", overflow: "hidden", minHeight: "0" },
    body: { display: "flex", flexDirection: "column", gap: "sm", padding: "xs" },
    // This measures the theme's preview size in pixels without copying it into JavaScript.
    preview: {
      position: "absolute",
      height: "chat-user-preview",
      width: "0",
      visibility: "hidden",
      pointerEvents: "none",
    },
    footer: {
      position: "absolute",
      bottom: "0",
      left: "0",
      right: "0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      px: "xs",
      pb: "xs",
      pt: "lg",
      backgroundImage: "linear-gradient(to bottom, transparent, var(--chat-message-bg) {spacing.lg})",
      pointerEvents: "none",
    },
  },
  variants: {
    expanded: {
      true: {
        viewport: { maxHeight: "chat-user-expanded", overflowY: "auto" },
        body: { paddingBottom: "3xl" },
      },
    },
  },
});
