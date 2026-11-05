import { chakra, useMenuContext } from "@chakra-ui/react";
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { ScopedMenu as Menu, useScopedMenu as useMenu } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import { ResourceMenuItems } from "./resource-menu-items";

type MenuRootProps = ComponentProps<typeof Menu.Root>;

export interface ResourceContextAction {
  key: string;
  label: string;
  commandId?: string;
  group?: { id: string; label?: string };
  isSelected?: boolean;
  /** Apply a state change at selection, before the closing animation or navigation. */
  onSelect?: () => void;
  /** Run after a closing menu releases focus, or immediately if it stays open. */
  onClick?: () => Promise<void> | void;
  /** Nested actions, opened by hover or the arrow keys. */
  items?: ResourceContextAction[];
  isDisabled?: boolean;
  icon?: ReactNode;
  endContent?: ReactNode;
  separatorBefore?: boolean;
  /** Override the menu's selection behavior for this action. */
  closeOnSelect?: boolean;
}

interface ResourceContextMenuProps {
  actions: ResourceContextAction[];
  children: ReactNode;
  contentMinWidth?: string;
  contentBackground?: string;
  positioning?: MenuRootProps["positioning"];
  /** Keep the menu open after selecting an item — useful for menus that toggle several entries in one pass. */
  closeOnSelect?: MenuRootProps["closeOnSelect"];
  /** Preserve the trigger tree while actions load or change. */
  keepMountedWhenEmpty?: boolean;
}

export interface ResourceActionMenuProps {
  actions: ResourceContextAction[];
  children: ReactElement;
  contentMinWidth?: string;
  contentBackground?: string;
  positioning?: MenuRootProps["positioning"];
  closeOnSelect?: MenuRootProps["closeOnSelect"];
}

const ResourceMenuContent = (props: {
  actions: ResourceContextAction[];
  contentMinWidth: string;
  contentBackground: string;
  onSelect: (action: ResourceContextAction) => void;
}) => {
  const { actions, contentBackground, contentMinWidth, onSelect } = props;
  const menu = useMenuContext();

  return (
    <Portal>
      <Menu.Positioner>
        {/* Long menus, such as Sidenav customization, scroll inside the space left in the viewport. */}
        <Menu.Content minW={contentMinWidth} bg={contentBackground} maxH="var(--available-height)">
          <ScrollArea flex="1" minH="0" viewportProps={{ overscrollBehavior: "contain", tabIndex: -1 }}>
            {menu.open ? <ResourceMenuItems actions={actions} onSelect={onSelect} /> : null}
          </ScrollArea>
        </Menu.Content>
      </Menu.Positioner>
    </Portal>
  );
};

const useResourceMenuActions = (closeOnSelect: boolean | undefined, beforeAction?: () => void) => {
  const pendingAction = useRef<ResourceContextAction | null>(null);
  return {
    onSelect: (action: ResourceContextAction) => {
      action.onSelect?.();
      if (action.closeOnSelect ?? closeOnSelect ?? true) pendingAction.current = action;
      else void action.onClick?.();
    },
    onExitComplete: () => {
      const action = pendingAction.current;
      pendingAction.current = null;
      // Closing menus finish their scheduled focus changes before an action focuses an input or dialog.
      if (action) {
        beforeAction?.();
        void action.onClick?.();
      }
    },
  };
};

export const ResourceActionMenu = (props: ResourceActionMenuProps) => {
  const {
    actions,
    children,
    contentMinWidth = "17.5rem",
    contentBackground = "bg",
    positioning = { placement: "bottom-start" },
    closeOnSelect,
  } = props;
  const { onSelect, onExitComplete } = useResourceMenuActions(closeOnSelect);

  if (actions.length === 0) return children;

  return (
    <Menu.Root positioning={positioning} closeOnSelect={closeOnSelect} onExitComplete={onExitComplete}>
      <Menu.Trigger asChild>{children}</Menu.Trigger>
      <ResourceMenuContent
        actions={actions}
        contentMinWidth={contentMinWidth}
        contentBackground={contentBackground}
        onSelect={onSelect}
      />
    </Menu.Root>
  );
};

type ContextTriggerProps = ReturnType<ReturnType<typeof useMenu>["api"]["getContextTriggerProps"]>;
type ContextMenuOpening = { type: "CONTEXT_MENU" | "CONTEXT_MENU_START"; point: { x: number; y: number } };

interface ResourceContextMenuMachineProps {
  triggerId: string;
  /** The gesture that mounted the machine, until the machine has replayed it. */
  opening: ContextMenuOpening | null;
  actions: ResourceContextAction[];
  contentMinWidth: string;
  contentBackground: string;
  positioning: MenuRootProps["positioning"];
  closeOnSelect: MenuRootProps["closeOnSelect"];
  getAnchorRect: () => { x: number; y: number; width: number; height: number };
  onEscapeKeyDown: () => void;
  onTriggerPropsChange: (triggerProps: ContextTriggerProps | null) => void;
  onOpeningSent: () => void;
  restoreTriggerFocus: () => void;
}

/** The menu machine for one trigger, mounted when that trigger first asks for its menu. */
const ResourceContextMenuMachine = (props: ResourceContextMenuMachineProps) => {
  const {
    triggerId,
    opening,
    onOpeningSent,
    actions,
    contentMinWidth,
    contentBackground,
    positioning,
    closeOnSelect,
    getAnchorRect,
    onEscapeKeyDown,
    onTriggerPropsChange,
    restoreTriggerFocus,
  } = props;
  const { onSelect, onExitComplete } = useResourceMenuActions(closeOnSelect, restoreTriggerFocus);
  const menu = useMenu({
    ids: { contextTrigger: triggerId },
    positioning: { ...positioning, strategy: "fixed", getAnchorRect },
    closeOnSelect,
    onEscapeKeyDown,
  });
  const triggerProps = menu.api.getContextTriggerProps();

  useLayoutEffect(() => {
    onTriggerPropsChange(triggerProps);
  });

  // The gesture that mounted this machine reached the trigger before the machine existed. It is sent once and then
  // cleared: effects run again when a hidden view is shown, and must not reopen the menu.
  // The service is a new object on every render, so it is read when the effect runs.
  const sendOpening = useEffectEvent((nextOpening: ContextMenuOpening) => {
    menu.service.send(nextOpening);
    onOpeningSent();
  });
  useLayoutEffect(() => {
    if (opening) sendOpening(opening);
  }, [opening]);

  useLayoutEffect(() => () => onTriggerPropsChange(null), [onTriggerPropsChange]);

  return (
    // Descendant resource menus are independent menus, not submenus.
    <Menu.RootProvider value={menu} lazyMount unmountOnExit onExitComplete={onExitComplete}>
      {actions.length > 0 ? (
        <ResourceMenuContent
          actions={actions}
          contentMinWidth={contentMinWidth}
          contentBackground={contentBackground}
          onSelect={onSelect}
        />
      ) : null}
    </Menu.RootProvider>
  );
};

const contextTriggerStyle = { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as const;

export const ResourceContextMenu = (props: ResourceContextMenuProps) => {
  const {
    actions,
    children,
    contentMinWidth = "17.5rem",
    contentBackground = "bg",
    positioning = { placement: "bottom-start" },
    closeOnSelect,
    keepMountedWhenEmpty = false,
  } = props;
  const triggerId = useId();
  const keyboardTrigger = useRef<HTMLElement | null>(null);
  const actionTrigger = useRef<HTMLElement | null>(null);
  const contextAnchor = useRef({ x: 0, y: 0, width: 0, height: 0 });
  // Lists draw many triggers, so each one starts its menu machine on its first use instead of on mount.
  const [machine, setMachine] = useState<{ opening: ContextMenuOpening | null } | null>(null);
  const triggerHandlers = useRef<ContextTriggerProps | null>(null);

  if (actions.length === 0 && !keepMountedWhenEmpty) {
    return <>{children}</>;
  }

  const rememberActionTrigger = (trigger: HTMLElement) => {
    const focused = trigger.ownerDocument.activeElement;
    actionTrigger.current = focused instanceof HTMLElement && trigger.contains(focused) ? focused : trigger;
  };

  const startMachine = (nextOpening: ContextMenuOpening) => {
    if (!machine) setMachine({ opening: nextOpening });
  };

  return (
    <>
      <chakra.div
        asChild
        id={triggerId}
        style={contextTriggerStyle}
        onPointerDown={(event) => {
          if (actions.length === 0 || event.pointerType === "mouse") return;
          keyboardTrigger.current = null;
          rememberActionTrigger(event.currentTarget);
          // Only the nearest populated menu starts the shared touch-hold gesture.
          event.stopPropagation();
          const point = { x: event.clientX, y: event.clientY };
          contextAnchor.current = { ...point, width: 0, height: 0 };
          if (triggerHandlers.current) triggerHandlers.current.onPointerDown?.(event);
          else startMachine({ type: "CONTEXT_MENU_START", point });
        }}
        onPointerMove={(event) => triggerHandlers.current?.onPointerMove?.(event)}
        onPointerUp={(event) => triggerHandlers.current?.onPointerUp?.(event)}
        onPointerCancel={(event) => triggerHandlers.current?.onPointerCancel?.(event)}
        onKeyDown={(event) => {
          if (event.defaultPrevented || actions.length === 0) return;
          if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
          event.preventDefault();
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          event.currentTarget.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              clientX: bounds.left,
              clientY: bounds.bottom,
            }),
          );
          // A context trigger may wrap the control that received the keyboard event.
          keyboardTrigger.current = event.target as HTMLElement;
        }}
        onContextMenu={(event) => {
          keyboardTrigger.current = null;
          if (actions.length > 0 && !event.defaultPrevented) {
            rememberActionTrigger(event.currentTarget);
            const point = { x: event.clientX, y: event.clientY };
            contextAnchor.current = { ...point, width: 0, height: 0 };
            event.stopPropagation();
            if (triggerHandlers.current) {
              triggerHandlers.current.onContextMenu?.(event);
              return;
            }
            event.preventDefault();
            startMachine({ type: "CONTEXT_MENU", point });
          }
        }}
      >
        {children}
      </chakra.div>
      {machine ? (
        <ResourceContextMenuMachine
          triggerId={triggerId}
          opening={machine.opening}
          onOpeningSent={() => setMachine({ opening: null })}
          restoreTriggerFocus={() => {
            // Positioned menus have no normal trigger to restore. Restore their origin before an action opens a dialog.
            if (actionTrigger.current?.isConnected) actionTrigger.current.focus({ preventScroll: true });
          }}
          actions={actions}
          contentMinWidth={contentMinWidth}
          contentBackground={contentBackground}
          positioning={positioning}
          closeOnSelect={closeOnSelect}
          getAnchorRect={() => contextAnchor.current}
          onEscapeKeyDown={() => {
            // Positioned context menus do not restore trigger focus themselves.
            const trigger = keyboardTrigger.current;
            keyboardTrigger.current = null;
            const previousFocus = document.activeElement;
            if (trigger) {
              requestAnimationFrame(() => {
                // A later focus choice belongs to its caller, even before the menu finishes closing.
                if (document.activeElement === previousFocus || document.activeElement === document.body) {
                  trigger.focus({ preventScroll: true });
                }
              });
            }
          }}
          onTriggerPropsChange={(triggerProps) => {
            triggerHandlers.current = triggerProps;
          }}
        />
      ) : null}
    </>
  );
};
