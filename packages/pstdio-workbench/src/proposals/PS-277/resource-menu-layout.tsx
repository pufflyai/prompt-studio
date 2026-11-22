import { Box, Flex, Stack } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import type { MenuHeaderPosition } from "./menu-header-state";
import type { ResourceMenuContentProps } from "./resource-menu-content";
import { ResourceMenuGroup } from "./resource-menu-group";
import { sides } from "./resource-menu-state";
import { TicketContent } from "./resource-navigation-content";
import { keepNavigationFocus } from "./resource-navigation-focus";

interface ResourceMenuLayoutProps extends Omit<ResourceMenuContentProps, "menu"> {
  page: boolean;
  compact: boolean;
  headerPosition: MenuHeaderPosition;
}

const compactMenuSide = (state: ResourceMenuLayoutProps["state"]) => {
  const focused = state.focusedMenu;
  if (focused && state.activeMenus[state.menuPositions[focused]] === focused) return state.menuPositions[focused];
  return sides.find((side) => state.activeMenus[side]);
};

const edgeGeometry = (side: "left" | "right", floating: boolean, header: MenuHeaderPosition) => {
  const offset = floating && header === side ? "14" : "0";
  return {
    maxW: floating ? "calc(100% - {sizes.14})" : "full",
    h: floating ? "auto" : "full",
    top: floating && header === "top" ? "14" : "0",
    bottom: floating && header === "bottom" ? "14" : "0",
    borderRightWidth: side === "left" ? "1px" : "0",
    borderLeftWidth: side === "right" ? "1px" : "0",
    position: floating ? "absolute" : "relative",
    insetInlineStart: side === "left" ? offset : undefined,
    insetInlineEnd: side === "right" ? offset : undefined,
    zIndex: floating ? "modal" : undefined,
  } as const;
};

const EdgeMenu = (props: ResourceMenuLayoutProps & { side: "left" | "right" }) => {
  const { side, page, compact, headerPosition, state, update, ...content } = props;
  const ref = useRef<HTMLDivElement>(null);
  const floating = compact && !(page && side === "left");
  const selected = state.activeMenus[side];
  const open = Boolean(selected);
  const hidden = (page && side === "left") || (compact && compactMenuSide(state) !== side);
  useEffect(() => {
    if (floating && open && !hidden) {
      ref.current?.focus();
    }
  }, [floating, open, hidden]);
  if (!selected || hidden) return null;
  const close = () => {
    update({ activeMenus: { ...state.activeMenus, [side]: undefined } });
    document.getElementById(`resource-menu-trigger-${selected}`)?.focus();
  };
  return (
    <>
      {floating ? (
        <Box
          as="button"
          position="absolute"
          inset="0"
          bg="blackAlpha.500"
          zIndex="overlay"
          aria-label="Dismiss menu"
          tabIndex={-1}
          onClick={close}
        />
      ) : null}
      <Box
        id={`resource-menu-${side}`}
        ref={ref}
        tabIndex={floating ? -1 : undefined}
        w="72"
        {...edgeGeometry(side, floating, headerPosition)}
        flexShrink="0"
        minH="0"
        bg="bg"
        borderColor="border.subtle"
        role={floating ? "dialog" : "region"}
        aria-modal={floating || undefined}
        aria-label={`${side} resource menus`}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
          if (floating) keepNavigationFocus(event);
        }}
      >
        <ResourceMenuGroup
          {...content}
          state={state}
          update={update}
          side={side}
          onNavigate={floating ? close : undefined}
        />
      </Box>
    </>
  );
};

export const ResourceMenuLayout = (props: ResourceMenuLayoutProps) => {
  const { state, update, ticket, compact, headerPosition } = props;
  return (
    <Flex flex="1" minW="0" minH="0" position="relative" overflow="hidden">
      <EdgeMenu {...props} side="left" />
      <Stack flex="1" minW="0" minH="0" gap="0">
        <TicketContent ticket={ticket} state={state} update={update} />
        {state.activeMenus.bottom && (!compact || compactMenuSide(state) === "bottom") ? (
          <Box
            id="resource-menu-bottom"
            h="48"
            maxH="50%"
            flexShrink="0"
            minH="0"
            borderTopWidth="1px"
            borderColor="border.subtle"
            position={compact ? "absolute" : "relative"}
            bottom={compact && headerPosition === "bottom" ? "14" : "0"}
            w="full"
            zIndex={compact ? "modal" : undefined}
          >
            <ResourceMenuGroup ticket={ticket} state={state} update={update} side="bottom" />
          </Box>
        ) : null}
      </Stack>
      <EdgeMenu {...props} side="right" />
    </Flex>
  );
};
