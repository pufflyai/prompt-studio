import type { HTMLChakraProps, RecipeVariantProps } from "@chakra-ui/react";
import { createSlotRecipeContext, defineSlotRecipe } from "@chakra-ui/react";

const recipe = defineSlotRecipe({
  className: "ai-message",
  slots: ["root", "content"],
  base: {
    root: {
      display: "flex",
      width: "full",
      alignItems: "end",
      justifyContent: "end",
      gap: "sm",
      "&:has(+ [data-scope='ai-message'][data-part='root'])": {
        mb: 0,
      },
    },
    content: {
      display: "flex",
      flexDirection: "column",
      gap: "sm",
      textStyle: "sm",
      overflow: "hidden",
    },
  },
  variants: {
    from: {
      user: {
        root: {
          mb: "md",
          flexDirection: "row",
        },
        content: {
          border: "1px solid",
          borderColor: "border.muted",
          bg: "bg.subtle",
          width: "full",
          borderBottomRightRadius: 0,
        },
      },
      assistant: {
        root: {
          mb: "md",
          flexDirection: "row",
          justifyContent: "start",
        },
        content: {
          width: "full",
        },
      },
      developer: {
        root: {
          width: "full",
          flexDirection: "row-reverse",
        },
        content: {
          width: "full",
        },
      },
    },
    size: {
      sm: {
        root: { gap: "xs" },
        content: { px: "xs", py: "xs", textStyle: "xs" },
      },
      md: {
        content: { px: "xs", py: "xs" },
      },
      lg: {
        root: { gap: "md" },
        content: { px: "sm", py: "xs", textStyle: "md" },
      },
    },
    shape: {
      rounded: {
        content: { rounded: "xs" },
      },
      pill: {
        content: { rounded: "full" },
      },
      square: {
        content: { rounded: "none" },
      },
    },
  },
  defaultVariants: {
    from: "user",
    size: "md",
    shape: "rounded",
  },
});

const { withProvider, withContext } = createSlotRecipeContext({ recipe });

type VariantProps = RecipeVariantProps<typeof recipe>;

export interface MessageRootProps extends HTMLChakraProps<"div">, VariantProps {}
export const MessageRoot = withProvider<HTMLDivElement, MessageRootProps>("div", "root");

export interface MessageContentProps extends HTMLChakraProps<"div">, VariantProps {}
export const MessageContent = withContext<HTMLDivElement, MessageContentProps>("div", "content");

export const ChatMessage = {
  Root: MessageRoot,
  Content: MessageContent,
} as const;
