import { defineSlotRecipe } from "@chakra-ui/react";

export const activityCommentSlotRecipe = defineSlotRecipe({
  className: "activity-comment",
  slots: ["root", "body", "content"],
  base: {
    root: {
      width: "full",
      borderWidth: "1px",
      borderRadius: "xs",
      overflow: "hidden",
    },
    body: {
      display: "flex",
      flexDirection: "column",
    },
    content: {
      color: "fg",
      overflowWrap: "anywhere",
      whiteSpace: "pre-wrap",
    },
  },
  variants: {
    tone: {
      default: {
        root: {
          background: "bg",
          borderColor: "border.subtle",
        },
      },
      attention: {
        root: {
          background: "bg.warning",
          borderColor: "border.warning",
        },
      },
    },
    size: {
      comfortable: {
        body: {
          gap: "sm",
          padding: "md",
        },
        content: {
          textStyle: "label/S/regular",
        },
      },
      compact: {
        body: {
          gap: "xs",
          padding: "sm",
        },
        content: {
          textStyle: "label/S/regular",
        },
      },
    },
  },
  defaultVariants: {
    tone: "default",
    size: "comfortable",
  },
});
