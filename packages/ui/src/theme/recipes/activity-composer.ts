import { defineSlotRecipe } from "@chakra-ui/react";
export const activityComposerSlotRecipe = defineSlotRecipe({
  className: "activity-composer",
  slots: ["root", "row", "input", "actions"],
  base: {
    root: { width: "full", background: "bg", borderColor: "border", borderRadius: "sm" },
    row: { display: "flex", gap: "xs", padding: "sm", alignItems: "center" },
    input: {
      flex: "1",
      minWidth: "0",
      border: "0",
      padding: "0",
      background: "transparent",
      textStyle: "label/S/regular",
    },
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
