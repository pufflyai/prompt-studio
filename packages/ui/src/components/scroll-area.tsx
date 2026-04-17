import { ScrollArea as ChakraScrollArea } from "@chakra-ui/react";
import * as React from "react";

type VerticalScrollbarProps = Omit<ChakraScrollArea.ScrollbarProps, "orientation">;
type HorizontalScrollbarProps = Omit<ChakraScrollArea.ScrollbarProps, "orientation">;

export interface ScrollAreaProps extends ChakraScrollArea.RootProps {
  viewportRef?: React.Ref<HTMLDivElement>;
  contentRef?: React.Ref<HTMLDivElement>;
  viewportProps?: ChakraScrollArea.ViewportProps;
  contentProps?: ChakraScrollArea.ContentProps;
  verticalScrollbarProps?: VerticalScrollbarProps;
  horizontalScrollbarProps?: HorizontalScrollbarProps;
  showVerticalScrollbar?: boolean;
  showHorizontalScrollbar?: boolean;
  showCorner?: boolean;
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(props, ref) {
  const {
    children,
    viewportRef,
    contentRef,
    viewportProps,
    contentProps,
    verticalScrollbarProps,
    horizontalScrollbarProps,
    showVerticalScrollbar = true,
    showHorizontalScrollbar = false,
    showCorner = showVerticalScrollbar && showHorizontalScrollbar,
    ...rest
  } = props;

  const mergedContentProps = showHorizontalScrollbar
    ? contentProps
    : { ...contentProps, style: { minWidth: 0, ...contentProps?.style } };

  return (
    <ChakraScrollArea.Root ref={ref} {...rest}>
      <ChakraScrollArea.Viewport {...viewportProps} ref={viewportRef}>
        <ChakraScrollArea.Content {...mergedContentProps} ref={contentRef}>
          {children}
        </ChakraScrollArea.Content>
      </ChakraScrollArea.Viewport>
      {showVerticalScrollbar ? <ChakraScrollArea.Scrollbar {...verticalScrollbarProps} borderRadius={"xs"} /> : null}
      {showHorizontalScrollbar ? (
        <ChakraScrollArea.Scrollbar orientation="horizontal" {...horizontalScrollbarProps} borderRadius={"xs"} />
      ) : null}
      {showCorner ? <ChakraScrollArea.Corner /> : null}
    </ChakraScrollArea.Root>
  );
});
