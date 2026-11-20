import { Dialog, Menu, mergeRefs, Popover, useMenu, useMenuContext, usePopoverContext } from "@chakra-ui/react";
import { forwardRef, useRef } from "react";
import { TriggerTooltip } from "../components/overlays/trigger-tooltip";
import { MenuContent } from "./menu-content";
import { OverlayTriggerContext, useOverlayTriggerId, useOverlayTriggerRef } from "./overlay-trigger";
import { PortalContainerContext, usePortalPositioning } from "./portal-container";
import { useUiScope } from "./ui-scope";
import { useScopedOpen } from "./use-scoped-open";

export { ScopedTooltip } from "./scoped-tooltip";

const DialogRoot = (props: Dialog.RootProps) => (
  <PortalContainerContext value={undefined}>
    <Dialog.Root {...useScopedOpen(props)} />
  </PortalContainerContext>
);
const DialogContent = forwardRef<HTMLDivElement, Dialog.ContentProps>((props, ref) => {
  const container = useRef<HTMLDivElement>(null);
  return (
    <PortalContainerContext value={container}>
      <Dialog.Content {...props} ref={mergeRefs(ref, container)} />
    </PortalContainerContext>
  );
});
const MenuRoot = (props: Menu.RootProps) => {
  const { triggerId, setTriggerId } = useOverlayTriggerId();
  return (
    <OverlayTriggerContext value={setTriggerId}>
      <Menu.Root
        {...useScopedOpen(props)}
        positioning={usePortalPositioning(props.positioning)}
        ids={{ ...props.ids, trigger: triggerId ?? props.ids?.trigger }}
      />
    </OverlayTriggerContext>
  );
};
const PopoverRoot = (props: Popover.RootProps) => {
  const { triggerId, setTriggerId } = useOverlayTriggerId();
  return (
    <OverlayTriggerContext value={setTriggerId}>
      <Popover.Root
        {...useScopedOpen(props)}
        positioning={usePortalPositioning(props.positioning)}
        ids={{ ...props.ids, trigger: triggerId ?? props.ids?.trigger }}
      />
    </OverlayTriggerContext>
  );
};

const MenuTrigger = forwardRef<HTMLButtonElement, Menu.TriggerProps>((props, ref) => {
  const menu = useMenuContext();
  return (
    <TriggerTooltip disabled={menu.open}>
      <Menu.Trigger {...props} ref={useOverlayTriggerRef(ref)} />
    </TriggerTooltip>
  );
});
const PopoverTrigger = forwardRef<HTMLButtonElement, Popover.TriggerProps>((props, ref) => {
  const popover = usePopoverContext();
  return (
    <TriggerTooltip disabled={popover.open}>
      <Popover.Trigger {...props} ref={useOverlayTriggerRef(ref)} />
    </TriggerTooltip>
  );
});

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

export const ScopedDialog: typeof Dialog = { ...Dialog, Root: DialogRoot, Content: DialogContent };
export const ScopedMenu: typeof Menu = {
  ...Menu,
  Root: MenuRoot,
  Content: MenuContent,
  RootProvider: MenuRootProvider,
  Trigger: MenuTrigger,
};
export const ScopedPopover: typeof Popover = {
  ...Popover,
  Root: PopoverRoot,
  RootProvider: PopoverRootProvider,
  Trigger: PopoverTrigger,
};
export const useScopedMenu: typeof useMenu = (props) => useMenu(useScopedOpen(props ?? {}));
