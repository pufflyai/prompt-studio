import { defineSlotRecipe } from "@chakra-ui/react";

const previewContentHeight = "calc({sizes.chat-user-preview} - {sizes.chat-user-footer})";

export const stickyUserMessageRecipe = defineSlotRecipe({
  slots: ["root", "viewport", "body", "preview", "footer", "actions"],
  base: {
    actions: { px: "xs", pb: "xs" },
    root: { position: "relative", padding: "0", gap: "0", overflow: "hidden" },
    viewport: { maxHeight: previewContentHeight, overflowY: "hidden", minHeight: "0" },
    body: { display: "flex", flexDirection: "column", gap: "sm", padding: "xs", paddingBottom: "0" },
    // Measure the space for text, excluding the footer, using the same theme sizes as the viewport.
    preview: {
      position: "absolute",
      height: previewContentHeight,
      width: "0",
      visibility: "hidden",
      pointerEvents: "none",
    },
    footer: {
      position: "relative",
      flexShrink: "0",
      minHeight: "chat-user-footer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "xs",
      paddingTop: "0",
      background: "var(--chat-message-bg)",
      _before: {
        content: '""',
        position: "absolute",
        bottom: "100%",
        left: "0",
        right: "0",
        height: "{spacing.3xl}",
        backgroundImage: "linear-gradient(to bottom, transparent, var(--chat-message-bg) 75%, var(--chat-message-bg))",
        pointerEvents: "none",
      },
    },
  },
  variants: {
    expanded: {
      true: {
        viewport: { maxHeight: "calc({sizes.chat-user-expanded} - {sizes.chat-user-footer})", overflowY: "auto" },
        footer: { _before: { display: "none" } },
      },
    },
  },
});
