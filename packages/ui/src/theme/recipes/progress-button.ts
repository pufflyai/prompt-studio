import { defineSlotRecipe } from "@chakra-ui/react";

export const progressButtonSlotRecipe = defineSlotRecipe({
  slots: ["button", "progress", "track", "range"],
  base: {
    button: {
      position: "relative",
      overflow: "hidden",
      flexShrink: "0",
      "&[data-status=success]": { color: "fg.success", bg: "bg" },
      "&[data-status=error]": { color: "fg.error", bg: "bg" },
      "&[data-status=running], &[data-status=queued]": { color: "fg", bg: "bg.muted" },
    },
    progress: { position: "absolute", insetInline: "0", bottom: "0", width: "full", pointerEvents: "none" },
    track: { height: "0.5", borderRadius: "0", bg: "bg.muted" },
    range: { bg: "currentColor" },
  },
});
