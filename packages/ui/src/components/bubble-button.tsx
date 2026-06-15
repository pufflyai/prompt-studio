import { chakra, type HTMLChakraProps, IconButton, type IconButtonProps } from "@chakra-ui/react";
import { forwardRef, type ReactNode } from "react";
import { Tooltip } from "./tooltip";

type BubbleButtonStyleProps = "boxShadow" | "transition" | "_hover" | "_active" | "borderColor" | "borderWidth";

export interface BubbleButtonProps extends Omit<IconButtonProps, BubbleButtonStyleProps> {
  containerProps?: HTMLChakraProps<"div">;
  isOpen?: boolean;
  tooltip?: ReactNode;
}

export const BubbleButton = forwardRef<HTMLButtonElement, BubbleButtonProps>(function BubbleButton(props, ref) {
  const { children, containerProps, isOpen = false, tooltip, ...rest } = props;
  const button = (
    <IconButton
      ref={ref}
      rounded="full"
      size="lg"
      borderWidth="1px"
      borderColor="border.subtle"
      boxShadow={isOpen ? "none" : "mid"}
      transition="box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out"
      _hover={{
        borderColor: "border.accent",
        boxShadow: "mid",
      }}
      _active={{ boxShadow: isOpen ? "none" : "mid" }}
      {...rest}
    >
      {children}
    </IconButton>
  );

  return (
    <chakra.div position="fixed" bottom="6" right="6" zIndex="docked" {...containerProps}>
      {tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button}
    </chakra.div>
  );
});
