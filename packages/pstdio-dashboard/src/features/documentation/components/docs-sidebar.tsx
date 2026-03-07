import { Menu, Text } from "@chakra-ui/react";
import { ItemSection, MenuItem, PanelMenu } from "@pstdio/ui";
import type { DocsSidebarItem } from "../data/api";
import { sidebarItemContainsLink } from "../utils";

interface DocsSidebarEntryProps {
  item: DocsSidebarItem;
  activeLink: string | null;
  onSelectLink: (link: string) => void;
}

interface DocsSidebarProps {
  menuItems: DocsSidebarItem[];
  activeLink: string | null;
  onSelectLink: (link: string) => void;
}

const DocsSidebarEntry = (props: DocsSidebarEntryProps) => {
  const { item, activeLink, onSelectLink } = props;
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

  const shouldStartOpen = sidebarItemContainsLink(item, activeLink);

  return (
    <ItemSection title={item.text} defaultOpen={shouldStartOpen}>
      {children.map((child, index) => (
        <DocsSidebarEntry
          key={`${child.text}-${child.link ?? index}`}
          item={child}
          activeLink={activeLink}
          onSelectLink={onSelectLink}
        />
      ))}
    </ItemSection>
  );
};

export const DocsSidebar = (props: DocsSidebarProps) => {
  const { menuItems, activeLink, onSelectLink } = props;

  return (
    <PanelMenu title="Docs" variant="compact">
      {menuItems.length === 0 ? (
        <Text textStyle="paragraph/S/regular" color="fg.muted" p="xs">
          No files
        </Text>
      ) : (
        menuItems.map((item, index) => (
          <DocsSidebarEntry
            key={`${item.text}-${item.link ?? index}`}
            item={item}
            activeLink={activeLink}
            onSelectLink={onSelectLink}
          />
        ))
      )}
    </PanelMenu>
  );
};
