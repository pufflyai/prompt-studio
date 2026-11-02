import { Dialog, Menu, Popover, Tooltip, useMenu } from "@chakra-ui/react";
import { useState } from "react";
import { useUiScope } from "./ui-scope";

/** Closing the machine releases focus traps and document listeners without forgetting an open overlay. */
const useScopedOpen = <
  Props extends {
    open?: boolean;
    defaultOpen?: boolean;
    unmountOnExit?: boolean;
    onOpenChange?: (details: { open: boolean }) => void;
  },
>(
  props: Props,
) => {
  const scope = useUiScope();
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  if (!scope) return props;
  return {
    ...props,
    open: scope.active && (props.open ?? open),
    unmountOnExit: scope.active ? props.unmountOnExit : false,
    onOpenChange: (details: { open: boolean }) => {
      if (!scope.active) return;
      setOpen(details.open);
      props.onOpenChange?.(details);
    },
  };
};
const DialogRoot = (props: Dialog.RootProps) => <Dialog.Root {...useScopedOpen(props)} />;
const MenuRoot = (props: Menu.RootProps) => <Menu.Root {...useScopedOpen(props)} />;
const PopoverRoot = (props: Popover.RootProps) => <Popover.Root {...useScopedOpen(props)} />;
const TooltipRoot = (props: Tooltip.RootProps) => <Tooltip.Root {...useScopedOpen(props)} />;

const MenuRootProvider = (props: Menu.RootProviderProps) => {
  const scope = useUiScope();
  return <Menu.RootProvider {...props} unmountOnExit={scope && !scope.active ? false : props.unmountOnExit} />;
};

export const ScopedDialog: typeof Dialog = { ...Dialog, Root: DialogRoot };
export const ScopedMenu: typeof Menu = { ...Menu, Root: MenuRoot, RootProvider: MenuRootProvider };
export const ScopedPopover: typeof Popover = { ...Popover, Root: PopoverRoot };
export const ScopedTooltip: typeof Tooltip = { ...Tooltip, Root: TooltipRoot };
export const useScopedMenu: typeof useMenu = (props) => useMenu(useScopedOpen(props ?? {}));
