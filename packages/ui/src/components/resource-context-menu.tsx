import { Menu, Portal } from "@chakra-ui/react";
import { type ComponentProps, Fragment, type ReactNode } from "react";
import { ListRow } from "./list-row/list-row";

type MenuRootProps = ComponentProps<typeof Menu.Root>;

export interface ResourceContextAction {
  key: string;
  label: string;
  onClick: () => Promise<void> | void;
  isDisabled?: boolean;
  icon?: ReactNode;
  endContent?: ReactNode;
  separatorBefore?: boolean;
}

interface ResourceContextMenuProps {
  actions: ResourceContextAction[];
  children: ReactNode;
  contentMinWidth?: string;
  contentBackground?: string;
  positioning?: MenuRootProps["positioning"];
  /** Keep the menu open after selecting an item — useful for menus that toggle several entries in one pass. */
  closeOnSelect?: MenuRootProps["closeOnSelect"];
}

export const ResourceContextMenu = (props: ResourceContextMenuProps) => {
  const {
    actions,
    children,
    contentMinWidth = "220px",
    contentBackground = "bg",
    positioning = { placement: "bottom-start" },
    closeOnSelect,
  } = props;

  if (actions.length === 0) {
    return <>{children}</>;
  }

  return (
    <Menu.Root positioning={positioning} closeOnSelect={closeOnSelect}>
      <Menu.ContextTrigger asChild>{children}</Menu.ContextTrigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW={contentMinWidth} bg={contentBackground}>
            {actions.map((action) => (
              <Fragment key={action.key}>
                {action.separatorBefore ? <Menu.Separator /> : null}
                <Menu.Item value={action.key} disabled={action.isDisabled} asChild>
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
              </Fragment>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
