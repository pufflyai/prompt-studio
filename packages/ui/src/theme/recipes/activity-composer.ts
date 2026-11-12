import { defineSlotRecipe } from "@chakra-ui/react";
import { chatComposerRecipe } from "./chat-composer";
export const activityComposerSlotRecipe = defineSlotRecipe({
  className: "activity-composer",
  slots: ["root", "row", "input", "actions"],
  base: {
    root: {
      ...chatComposerRecipe.base?.input,
      display: "flex",
      flexDirection: "column",
      gap: "xs",
      borderColor: "border",
    },
    row: { display: "flex", gap: "xs", alignItems: "center", minWidth: "0" },
    input: { flex: "1", minWidth: "0", height: "7", minHeight: "0", padding: "0", textStyle: "label/S/regular" },
    actions: { display: "flex", gap: "2xs", flexShrink: "0", alignItems: "center" },
  },
  variants: {
    variant: {
      standalone: { root: { borderWidth: "1px" } },
      inline: { root: { borderWidth: "0" } },
      compact: { root: { borderWidth: "1px" } },
    },
  },
  defaultVariants: { variant: "compact" },
});
