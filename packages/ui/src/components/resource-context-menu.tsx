import { Menu, Portal } from "@chakra-ui/react";
import type { ComponentProps, ReactNode } from "react";
import { MenuItem } from "./menu-item";

type MenuRootProps = ComponentProps<typeof Menu.Root>;

export interface ResourceContextAction {
  key: string;
  label: string;
  onClick: () => void;
  isDisabled?: boolean;
  icon?: ComponentProps<typeof MenuItem>["leftIcon"];
}

interface ResourceContextMenuProps {
  actions: ResourceContextAction[];
  children: ReactNode;
  contentMinWidth?: string;
  contentBackground?: string;
  positioning?: MenuRootProps["positioning"];
}

export const ResourceContextMenu = (props: ResourceContextMenuProps) => {
  const {
    actions,
    children,
    contentMinWidth = "220px",
    contentBackground = "bg",
    positioning = { placement: "bottom-start" },
  } = props;

  if (actions.length === 0) {
    return <>{children}</>;
  }

  return (
    <Menu.Root positioning={positioning}>
      <Menu.ContextTrigger asChild>{children}</Menu.ContextTrigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW={contentMinWidth} bg={contentBackground}>
            {actions.map((action) => (
              <MenuItem
                key={action.key}
                primaryLabel={action.label}
                leftIcon={action.icon ?? null}
                isDisabled={action.isDisabled}
                onClick={action.onClick}
              />
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
