import { Menu, Text } from "@chakra-ui/react";
import { ItemSection } from "../item-section";
import { MenuItem } from "../menu-item";
import { PanelMenu } from "../panel-menu";

export interface DocsSidebarItem {
  text: string;
  link?: string;
  items?: DocsSidebarItem[];
}

interface DocsSidebarEntryProps {
  item: DocsSidebarItem;
  activeLink: string | null;
  onSelectLink: (link: string) => void;
  shouldStartOpen?: (item: DocsSidebarItem) => boolean;
}

export interface DocsSidebarProps {
  title: string;
  emptyMessage?: string;
  menuItems: DocsSidebarItem[];
  activeLink: string | null;
  onSelectLink: (link: string) => void;
  shouldStartOpen?: (item: DocsSidebarItem) => boolean;
}

const DocsSidebarEntry = (props: DocsSidebarEntryProps) => {
  const { item, activeLink, onSelectLink, shouldStartOpen } = props;
  const children = item.items ?? [];
  const hasChildren = children.length > 0;

  if (!hasChildren && item.link) {
    const link = item.link;
    const isActive = item.link === activeLink;
    return (
      <Menu.Root>
        <MenuItem primaryLabel={item.text} isSelected={isActive} variant="compact" onClick={() => onSelectLink(link)} />
      </Menu.Root>
    );
  }

  if (!hasChildren) {
    return (
      <Menu.Root>
        <MenuItem primaryLabel={item.text} isDisabled variant="compact" />
      </Menu.Root>
    );
  }

  const defaultOpen = shouldStartOpen?.(item) ?? false;

  return (
    <ItemSection title={item.text} defaultOpen={defaultOpen}>
      {children.map((child, index) => (
        <DocsSidebarEntry
          key={`${child.text}-${child.link ?? index}`}
          item={child}
          activeLink={activeLink}
          onSelectLink={onSelectLink}
          shouldStartOpen={shouldStartOpen}
        />
      ))}
    </ItemSection>
  );
};

export const DocsSidebar = (props: DocsSidebarProps) => {
  const { title, emptyMessage, menuItems, activeLink, onSelectLink, shouldStartOpen } = props;

  return (
    <PanelMenu title={title} variant="compact">
      {menuItems.length === 0 ? (
        <Text textStyle="paragraph/S/regular" color="fg.muted" p="xs">
          {emptyMessage ?? "No files found"}
        </Text>
      ) : (
        menuItems.map((item, index) => (
          <DocsSidebarEntry
            key={`${item.text}-${item.link ?? index}`}
            item={item}
            activeLink={activeLink}
            onSelectLink={onSelectLink}
            shouldStartOpen={shouldStartOpen}
          />
        ))
      )}
    </PanelMenu>
  );
};
