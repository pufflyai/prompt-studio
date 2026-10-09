import { chakra, Menu, Portal, useMenu } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import { type ComponentProps, Fragment, type ReactElement, type ReactNode, useRef } from "react";
import { ListRow } from "@/components/list-row/list-row";
import { ScrollArea } from "@/components/primitives/scroll-area";

type MenuRootProps = ComponentProps<typeof Menu.Root>;

export interface ResourceContextAction {
  key: string;
  label: string;
  commandId?: string;
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

  return (
    <Portal>
      <Menu.Positioner>
        {/* Long menus, such as Sidenav customization, scroll inside the space left in the viewport. */}
        <Menu.Content minW={contentMinWidth} bg={contentBackground} maxH="var(--available-height)">
          <ScrollArea flex="1" minH="0" viewportProps={{ overscrollBehavior: "contain", tabIndex: -1 }}>
            {actions.map((action) => (
              <Fragment key={action.key}>
                {action.separatorBefore ? <Menu.Separator /> : null}
                {action.items && !action.isDisabled ? (
                  <Menu.Root positioning={{ placement: "right-start", gutter: 2 }} closeOnSelect={false}>
                    <Menu.TriggerItem asChild>
                      <ListRow
                        asChild
                        variant="full-width"
                        label={action.label}
                        icon={action.icon}
                        endContent={<ChevronRight size={14} />}
                      />
                    </Menu.TriggerItem>
                    <ResourceMenuContent
                      actions={action.items}
                      contentMinWidth={contentMinWidth}
                      contentBackground={contentBackground}
                      onSelect={onSelect}
                    />
                  </Menu.Root>
                ) : (
                  <Menu.Item
                    value={action.key}
                    disabled={action.isDisabled}
                    closeOnSelect={action.closeOnSelect}
                    asChild
                  >
                    <ListRow
                      asChild
                      variant="full-width"
                      label={action.label}
                      icon={action.icon}
                      endContent={action.items ? <ChevronRight size={14} /> : action.endContent}
                      disabled={action.isDisabled}
                      onActivate={() => onSelect(action)}
                    />
                  </Menu.Item>
                )}
              </Fragment>
            ))}
          </ScrollArea>
        </Menu.Content>
      </Menu.Positioner>
    </Portal>
  );
};

const useResourceMenuActions = (closeOnSelect: boolean | undefined) => {
  const pendingAction = useRef<ResourceContextAction | null>(null);
  return {
    onSelect: (action: ResourceContextAction) => {
      if (action.closeOnSelect ?? closeOnSelect ?? true) pendingAction.current = action;
      else void action.onClick?.();
    },
    onExitComplete: () => {
      const action = pendingAction.current;
      pendingAction.current = null;
      // Closing menus finish their scheduled focus changes before an action focuses an input or dialog.
      void action?.onClick?.();
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
  const { onSelect, onExitComplete } = useResourceMenuActions(closeOnSelect);
  const keyboardTrigger = useRef<HTMLElement | null>(null);
  const menu = useMenu({
    positioning,
    closeOnSelect,
    onEscapeKeyDown: () => {
      // Positioned context menus do not restore trigger focus themselves.
      const trigger = keyboardTrigger.current;
      keyboardTrigger.current = null;
      if (trigger) requestAnimationFrame(() => trigger.focus());
    },
  });
  const triggerProps = menu.api.getContextTriggerProps();

  if (actions.length === 0 && !keepMountedWhenEmpty) {
    return <>{children}</>;
  }

  return (
    <>
      <chakra.div
        asChild
        {...triggerProps}
        onPointerDown={(event) => {
          if (actions.length === 0 || event.pointerType === "mouse") return;
          keyboardTrigger.current = null;
          // Only the nearest populated menu starts the shared touch-hold gesture.
          event.stopPropagation();
          triggerProps.onPointerDown?.(event);
        }}
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
          keyboardTrigger.current = event.currentTarget;
        }}
        onContextMenu={(event) => {
          keyboardTrigger.current = null;
          if (actions.length > 0 && !event.defaultPrevented) triggerProps.onContextMenu?.(event);
        }}
      >
        {children}
      </chakra.div>
      {/* Descendant resource menus are independent menus, not submenus. */}
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
    </>
  );
};
