import { chakra, type HTMLChakraProps, useRecipe } from "@chakra-ui/react";
import type { BubbleAnchor } from "@/theme/recipes/bubble-anchor";

interface BubbleTargetProps extends HTMLChakraProps<"div"> {
  anchor: BubbleAnchor;
  nearest?: boolean;
  active?: boolean;
}

export const BubbleTarget = (props: BubbleTargetProps) => {
  const { anchor, nearest, active, ...rest } = props;
  const recipe = useRecipe({ key: "bubbleLauncher" });
  return (
    <chakra.div
      position="absolute"
      css={recipe({ anchor, target: true })}
      data-bubble-target={anchor}
      data-nearest={nearest}
      data-active={active}
      aria-hidden
      {...rest}
    />
  );
};
