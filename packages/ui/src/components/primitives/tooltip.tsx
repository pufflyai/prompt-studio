import { useTooltipContext } from "@chakra-ui/react";
import * as React from "react";
import { flushSync } from "react-dom";
import { ScopedTooltip as ChakraTooltip } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";

export interface TooltipProps extends React.ComponentProps<typeof ChakraTooltip.Root> {
  children?: React.ReactElement;
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement>;
  content: React.ReactNode;
  contentProps?: React.ComponentProps<typeof ChakraTooltip.Content>;
  disabled?: boolean;
  /** Show the tooltip only while this label is clipped. */
  overflowRef?: React.RefObject<HTMLElement | null>;
}

export const tooltipOpenDelay = 380;

const TooltipHoverReset = (props: { disabled: boolean }) => {
  const { disabled } = props;
  const api = useTooltipContext();
  const lastEnabledLeave = React.useRef<(() => void) | undefined>(undefined);

  React.useLayoutEffect(() => {
    if (!disabled) lastEnabledLeave.current = api.getTriggerProps().onPointerLeave as (() => void) | undefined;
  }, [api, disabled]);

  React.useLayoutEffect(() => {
    // Zag ignores leave while disabled; its current callback does not use an event.
    // See documentation/adrs/0088-temporary-tooltip-hover-reset.md.
    if (disabled) lastEnabledLeave.current?.();
  }, [disabled]);

  return null;
};

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(function Tooltip(props, ref) {
  const { children, disabled, portalled = true, content, contentProps, portalRef, ids, overflowRef, ...rest } = props;
  const [overflowing, setOverflowing] = React.useState(false);

  React.useLayoutEffect(() => {
    // Closed labels need no layout work until someone points at or focuses them.
    if (!overflowing && !rest.open && !rest.defaultOpen) return;
    const label = overflowRef?.current;
    if (!label) return;
    const measure = () => setOverflowing(label.scrollWidth > label.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(label);
    const textObserver = new MutationObserver(measure);
    textObserver.observe(label, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      textObserver.disconnect();
    };
  }, [overflowRef, overflowing, rest.open, rest.defaultOpen]);

  const isEmptyContent = (node: React.ReactNode): boolean => {
    if (node === null || node === undefined || node === false) return true;
    const arr = React.Children.toArray(node);
    if (arr.length === 0) return true;
    return arr.every((child) => (typeof child === "string" ? child.trim().length === 0 : false));
  };

  const unavailable = disabled || isEmptyContent(content);
  if (unavailable && !overflowRef) return children;
  // Keep overflow labels mounted so their observers and keyboard focus survive eligibility changes.
  const visibilityBlocked = Boolean(unavailable || (overflowRef && !overflowing));

  const measureOnIntent = () => {
    const label = overflowRef?.current;
    if (unavailable || !label || overflowing) return;
    const next = label.scrollWidth > label.clientWidth;
    // Zag must see the enabled trigger before handling this same pointer/focus event.
    if (next) flushSync(() => setOverflowing(true));
  };
  const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement>> | undefined;
  const trigger =
    overflowRef && child
      ? React.cloneElement(child, {
          onPointerOverCapture(event) {
            child.props.onPointerOverCapture?.(event);
            measureOnIntent();
          },
          onPointerMoveCapture(event) {
            child.props.onPointerMoveCapture?.(event);
            measureOnIntent();
          },
          onFocusCapture(event) {
            child.props.onFocusCapture?.(event);
            measureOnIntent();
          },
        })
      : children;

  // A trigger child's own id replaces the generated trigger id, and Zag finds the anchor by that id.
  const childId = (children?.props as { id?: string } | undefined)?.id;

  return (
    <ChakraTooltip.Root
      openDelay={tooltipOpenDelay}
      closeDelay={100}
      ids={{ trigger: childId, ...ids }}
      {...rest}
      disabled={visibilityBlocked}
      open={visibilityBlocked && rest.open !== undefined ? false : rest.open}
    >
      <TooltipHoverReset disabled={visibilityBlocked} />
      <ChakraTooltip.Trigger asChild>{trigger}</ChakraTooltip.Trigger>
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
