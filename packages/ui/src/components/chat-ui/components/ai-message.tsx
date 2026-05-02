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
      animationName: "message-fade-in",
      animationDuration: "200ms",
      animationTimingFunction: "ease-out",
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
      borderRadius: "0",
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
          borderTopWidth: "1px",
          borderBottomWidth: "1px",
          borderColor: "border.muted",
          bg: "bg.subtle",
          px: "xs",
          py: "xs",
          width: "full",
          borderRadius: "0",
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
          px: "xs",
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
        content: { textStyle: "xs" },
      },
      md: {},
      lg: {
        root: { gap: "md" },
        content: { textStyle: "md" },
      },
    },
    shape: {
      rounded: {
        content: { rounded: "0" },
      },
      pill: {
        content: { rounded: "0" },
      },
      square: {
        content: { rounded: "0" },
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
