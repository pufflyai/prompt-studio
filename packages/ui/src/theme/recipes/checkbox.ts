import { defineSlotRecipe } from "@chakra-ui/react";

export const checkboxSlotRecipe = defineSlotRecipe({
  slots: ["root", "control", "indicator", "label", "group"],
  base: { control: { borderRadius: "xs" } },
  variants: {
    size: {
      xs: {
        root: { gap: "2xs" },
        control: { boxSize: "3", borderRadius: "2xs" },
        indicator: { boxSize: "2.5" },
        label: { textStyle: "label/XS" },
      },
    },
  },
});
