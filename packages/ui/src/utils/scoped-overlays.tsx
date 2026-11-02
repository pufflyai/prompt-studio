import { Dialog, Menu, Popover, Tooltip, useMenu } from "@chakra-ui/react";
import { forwardRef, useState } from "react";
import { OverlayTriggerContext, useOverlayTriggerId, useOverlayTriggerRef } from "./overlay-trigger";
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
const MenuRoot = (props: Menu.RootProps) => {
  const { triggerId, setTriggerId } = useOverlayTriggerId();
  return (
    <OverlayTriggerContext value={setTriggerId}>
      <Menu.Root {...useScopedOpen(props)} ids={{ ...props.ids, trigger: triggerId ?? props.ids?.trigger }} />
    </OverlayTriggerContext>
  );
};
const PopoverRoot = (props: Popover.RootProps) => {
  const { triggerId, setTriggerId } = useOverlayTriggerId();
  return (
    <OverlayTriggerContext value={setTriggerId}>
      <Popover.Root {...useScopedOpen(props)} ids={{ ...props.ids, trigger: triggerId ?? props.ids?.trigger }} />
    </OverlayTriggerContext>
  );
};
const TooltipRoot = (props: Tooltip.RootProps) => <Tooltip.Root {...useScopedOpen(props)} />;

const MenuTrigger = forwardRef<HTMLButtonElement, Menu.TriggerProps>((props, ref) => (
  <Menu.Trigger {...props} ref={useOverlayTriggerRef(ref)} />
));
const PopoverTrigger = forwardRef<HTMLButtonElement, Popover.TriggerProps>((props, ref) => (
  <Popover.Trigger {...props} ref={useOverlayTriggerRef(ref)} />
));

const MenuRootProvider = (props: Menu.RootProviderProps) => {
  const scope = useUiScope();
  return (
    <OverlayTriggerContext value={null}>
      <Menu.RootProvider {...props} unmountOnExit={scope && !scope.active ? false : props.unmountOnExit} />
    </OverlayTriggerContext>
  );
};
const PopoverRootProvider = (props: Popover.RootProviderProps) => (
  <OverlayTriggerContext value={null}>
    <Popover.RootProvider {...props} />
  </OverlayTriggerContext>
);

export const ScopedDialog: typeof Dialog = { ...Dialog, Root: DialogRoot };
export const ScopedMenu: typeof Menu = {
  ...Menu,
  Root: MenuRoot,
  RootProvider: MenuRootProvider,
  Trigger: MenuTrigger,
};
export const ScopedPopover: typeof Popover = {
  ...Popover,
  Root: PopoverRoot,
  RootProvider: PopoverRootProvider,
  Trigger: PopoverTrigger,
};
export const ScopedTooltip: typeof Tooltip = { ...Tooltip, Root: TooltipRoot };
export const useScopedMenu: typeof useMenu = (props) => useMenu(useScopedOpen(props ?? {}));
