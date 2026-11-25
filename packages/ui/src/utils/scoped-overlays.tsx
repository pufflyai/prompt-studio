import { Dialog, Menu, mergeRefs, Popover, useMenu, useMenuContext, usePopoverContext } from "@chakra-ui/react";
import { createContext, forwardRef, useContext, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { TriggerTooltip } from "../components/overlays/trigger-tooltip";
import { MenuContent } from "./menu-content";
import { OverlayTriggerContext, useOverlayTriggerId, useOverlayTriggerRef } from "./overlay-trigger";
import { PortalContainerContext, usePortalPositioning } from "./portal-container";
import { useUiScope, useUiScopeViewActivity } from "./ui-scope";
import { useScopedOpen } from "./use-scoped-open";

export { ScopedTooltip } from "./scoped-tooltip";

type PopoverEscape = (event: KeyboardEvent) => boolean;
const DialogEscapeContext = createContext<Set<PopoverEscape> | null>(null);
const PopoverEscapeContext = createContext<Pick<Popover.RootProps, "closeOnEscape" | "onEscapeKeyDown"> | null>(null);

const DialogRoot = (props: Dialog.RootProps) => {
  const [popovers] = useState(() => new Set<PopoverEscape>());
  return (
    <PortalContainerContext value={undefined}>
      <DialogEscapeContext value={popovers}>
        <Dialog.Root
          {...useScopedOpen(props)}
          onEscapeKeyDown={(event) => {
            // Zag still calls the dialog while the visible popover waits to join its layer stack. See ADR 0165.
            if ([...popovers].reverse().some((handleEscape) => handleEscape(event))) return;
            props.onEscapeKeyDown?.(event);
          }}
        />
      </DialogEscapeContext>
    </PortalContainerContext>
  );
};
const DialogRootProvider = (props: Dialog.RootProviderProps) => (
  <DialogEscapeContext value={null}>
    <Dialog.RootProvider {...props} />
  </DialogEscapeContext>
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
      <PopoverEscapeContext value={props}>
        <Popover.Root
          {...useScopedOpen(props)}
          positioning={usePortalPositioning(props.positioning)}
          ids={{ ...props.ids, trigger: triggerId ?? props.ids?.trigger }}
        />
      </PopoverEscapeContext>
    </OverlayTriggerContext>
  );
};
const PopoverContent = forwardRef<HTMLDivElement, Popover.ContentProps>((props, ref) => {
  const popover = usePopoverContext();
  const owner = useContext(DialogEscapeContext);
  const escapeOptions = useContext(PopoverEscapeContext);
  const scope = useUiScope();
  const activity = useUiScopeViewActivity();
  const content = useRef<HTMLDivElement>(null);
  const handleEscape = useEffectEvent((event: KeyboardEvent) => {
    if (!content.current?.checkVisibility({ visibilityProperty: true })) return false;
    // A provider's connected API does not expose its Escape policy. Keep the dialog open and let Zag handle it.
    if (escapeOptions) {
      escapeOptions.onEscapeKeyDown?.(event);
      if (!event.defaultPrevented && escapeOptions.closeOnEscape !== false) popover.setOpen(false);
    }
    event.preventDefault();
    return true;
  });
  const active = (scope?.active ?? true) && activity.active;
  useLayoutEffect(() => {
    if (!owner || !popover.open || !active) return;
    const dismiss = (event: KeyboardEvent) => handleEscape(event);
    owner.add(dismiss);
    return () => {
      owner.delete(dismiss);
    };
  }, [active, owner, popover.open]);
  return <Popover.Content {...props} ref={mergeRefs(ref, content)} />;
});

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
    <PopoverEscapeContext value={null}>
      <Popover.RootProvider {...props} />
    </PopoverEscapeContext>
  </OverlayTriggerContext>
);

export const ScopedDialog: typeof Dialog = {
  ...Dialog,
  Root: DialogRoot,
  RootProvider: DialogRootProvider,
  Content: DialogContent,
};
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
  Content: PopoverContent,
  RootProvider: PopoverRootProvider,
  Trigger: PopoverTrigger,
};
export const useScopedMenu: typeof useMenu = (props) => useMenu(useScopedOpen(props ?? {}));
