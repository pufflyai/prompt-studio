import { Badge as ChakraBadge, Button as ChakraButton, useChakraContext } from "@chakra-ui/react";
import type { ComponentProps } from "react";

interface ButtonProps extends Omit<ComponentProps<typeof ChakraButton>, "variant"> {
  variant?:
    | "primary"
    | "outline"
    | "ghost"
    | "ghost-static"
    | "display-link"
    | "destructive"
    | "destructive-ghost"
    | "subtle";
}
interface BadgeProps extends Omit<ComponentProps<typeof ChakraBadge>, "variant"> {
  variant?: "ticket";
}

// Public recipes retain the provided theme's variants without repository-generated Chakra typings.
export const Button = (props: ButtonProps) => {
  const { variant, ...rest } = props;
  const recipe = useChakraContext().getRecipe("button");
  return (
    <ChakraButton
      {...rest}
      recipe={{
        ...recipe,
        defaultVariants: variant === undefined ? recipe?.defaultVariants : { ...recipe?.defaultVariants, variant },
      }}
    />
  );
};
export const Badge = (props: BadgeProps) => {
  const { variant, ...rest } = props;
  const recipe = useChakraContext().getRecipe("badge");
  return (
    <ChakraBadge
      {...rest}
      recipe={{
        ...recipe,
        defaultVariants: variant === undefined ? recipe?.defaultVariants : { ...recipe?.defaultVariants, variant },
      }}
    />
  );
};
