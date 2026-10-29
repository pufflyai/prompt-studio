import { Button, HStack, Menu, Popover, Portal, Text, Tooltip } from "@chakra-ui/react";
import type { WebviewOverlayRequest } from "@pstdio/sdk/extensions";
import { useLayoutEffect, useState } from "react";

export interface WebviewOverlaySurfaceProps {
  request: WebviewOverlayRequest;
  getAnchorRect(): DOMRect;
  close(actionId?: string, restoreFocus?: boolean): void;
}

/** A host surface for plain extension content. It never mounts guest HTML or components. */
const HostedOverlay = (props: WebviewOverlaySurfaceProps) => {
  const { request, getAnchorRect, close } = props;
  const { content } = request;
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => setOpen(true), []);
  const positioning = {
    getAnchorRect,
    placement: request.placement ?? ("bottom" as const),
    strategy: "fixed" as const,
  };
  if (content.kind === "tooltip")
    return (
      <Tooltip.Root open={open} positioning={positioning}>
        <Portal>
          <Tooltip.Positioner>
            <Tooltip.Content>{content.text}</Tooltip.Content>
          </Tooltip.Positioner>
        </Portal>
      </Tooltip.Root>
    );
  if (content.kind === "menu")
    return (
      <Menu.Root
        open={open}
        positioning={positioning}
        onSelect={({ value }) => close(value)}
        onEscapeKeyDown={() => close()}
        onInteractOutside={() => close(undefined, false)}
      >
        <Portal>
          <Menu.Positioner>
            <Menu.Content aria-label={content.label}>
              {content.items.map((item) => (
                <Menu.Item key={item.id} value={item.id} disabled={item.disabled}>
                  {item.label}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    );
  return (
    <Popover.Root
      open={open}
      positioning={positioning}
      onEscapeKeyDown={() => close()}
      onInteractOutside={() => close(undefined, false)}
    >
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Body>
              <Popover.Title>{content.title}</Popover.Title>
              <Text textStyle="paragraph/S/regular">{content.text}</Text>
              {content.actions?.length ? (
                <HStack gap="xs">
                  {content.actions.map((action) => (
                    <Button key={action.id} size="sm" disabled={action.disabled} onClick={() => close(action.id)}>
                      {action.label}
                    </Button>
                  ))}
                </HStack>
              ) : null}
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

export const WebviewOverlaySurface = (props: WebviewOverlaySurfaceProps) => (
  <HostedOverlay key={props.request.id} {...props} />
);
