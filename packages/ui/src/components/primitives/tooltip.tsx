import { Tooltip as ChakraTooltip, Portal } from "@chakra-ui/react";
import * as React from "react";

export interface TooltipProps extends ChakraTooltip.RootProps {
  children?: React.ReactElement;
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement>;
  content: React.ReactNode;
  contentProps?: ChakraTooltip.ContentProps;
  disabled?: boolean;
}

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(function Tooltip(props, ref) {
  const { children, disabled, portalled = true, content, contentProps, portalRef, ids, ...rest } = props;

  const isEmptyContent = (node: React.ReactNode): boolean => {
    if (node === null || node === undefined || node === false) return true;
    const arr = React.Children.toArray(node);
    if (arr.length === 0) return true;
    return arr.every((child) => (typeof child === "string" ? child.trim().length === 0 : false));
  };

  if (disabled || isEmptyContent(content)) return children;

  // A trigger child's own id replaces the generated trigger id, and Zag finds the anchor by that id.
  const childId = (children?.props as { id?: string } | undefined)?.id;

  return (
    <ChakraTooltip.Root openDelay={100} closeDelay={100} ids={{ trigger: childId, ...ids }} {...rest}>
      <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
      <Portal disabled={!portalled} container={portalRef}>
        <ChakraTooltip.Positioner>
          <ChakraTooltip.Content ref={ref} {...contentProps}>
            {content}
          </ChakraTooltip.Content>
        </ChakraTooltip.Positioner>
      </Portal>
    </ChakraTooltip.Root>
  );
});
