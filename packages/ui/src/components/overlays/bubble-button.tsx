import { chakra, type HTMLChakraProps, IconButton, type IconButtonProps, useRecipe } from "@chakra-ui/react";
import { forwardRef, type ReactNode } from "react";
import { Tooltip } from "@/components/primitives/tooltip";
import type { BubbleAnchor } from "@/theme/recipes/bubble-anchor";

type BubbleButtonStyleProps = "transition" | "_hover" | "_active" | "borderColor" | "borderWidth";

export interface BubbleButtonProps extends Omit<IconButtonProps, BubbleButtonStyleProps> {
  containerProps?: HTMLChakraProps<"div"> & { [attribute: `data-${string}`]: string | boolean | undefined };
  isOpen?: boolean;
  isDragging?: boolean;
  tooltip?: ReactNode;
  anchor?: BubbleAnchor;
}

export const BubbleButton = forwardRef<HTMLButtonElement, BubbleButtonProps>(function BubbleButton(props, ref) {
  const {
    children,
    containerProps,
    isOpen = false,
    isDragging = false,
    tooltip,
    anchor = "bottom-right",
    ...rest
  } = props;
  const motion = useRecipe({ key: "bubbleLauncher" });
  const button = (
    <IconButton ref={ref} size="lg" aria-pressed={isOpen} data-dragging={isDragging || undefined} {...rest}>
      {children}
    </IconButton>
  );

  return (
    <chakra.div
      position="fixed"
      zIndex="docked"
      {...containerProps}
      css={motion({ anchor })}
      data-open={isOpen}
      aria-hidden={isOpen}
      inert={isOpen}
    >
      {tooltip ? (
        <Tooltip content={tooltip} open={isOpen || isDragging ? false : undefined}>
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </chakra.div>
  );
});
