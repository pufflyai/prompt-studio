import { Menu, Portal } from "@chakra-ui/react";
import type { ComponentProps, ReactNode } from "react";
import { ListRow } from "./list-row/list-row";

type MenuRootProps = ComponentProps<typeof Menu.Root>;

export interface ResourceContextAction {
  key: string;
  label: string;
  onClick: () => void;
  isDisabled?: boolean;
  icon?: ReactNode;
  endContent?: ReactNode;
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
              <Menu.Item key={action.key} value={action.key} asChild>
                <ListRow
                  asChild
                  variant="compact"
                  label={action.label}
                  icon={action.icon}
                  endContent={action.endContent}
                  disabled={action.isDisabled}
                  onActivate={action.onClick}
                />
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
