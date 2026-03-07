import { Collapsible, Menu, Stack, Text } from "@chakra-ui/react";
import { MenuItem, PanelMenu } from "@pstdio/ui";
import { ChevronRight } from "lucide-react";
import type { DocsSidebarItem } from "../data/api";
import { sidebarItemContainsLink } from "../utils";

interface DocsSidebarEntryProps {
  item: DocsSidebarItem;
  activeLink: string | null;
  depth: number;
  onSelectLink: (link: string) => void;
}

interface DocsSidebarProps {
  menuItems: DocsSidebarItem[];
  activeLink: string | null;
  onSelectLink: (link: string) => void;
}

export const DocsSidebarEntry = (props: DocsSidebarEntryProps) => {
  const { item, activeLink, depth, onSelectLink } = props;
  const children = item.items ?? [];
  const hasChildren = children.length > 0;

  if (!hasChildren && item.link) {
    const link = item.link;
    const isActive = item.link === activeLink;

    return <MenuItem primaryLabel={item.text} isSelected={isActive} onClick={() => onSelectLink(link)} />;
  }

  if (!hasChildren) {
    return <MenuItem primaryLabel={item.text} isDisabled />;
  }

  const shouldStartOpen = depth === 0 || sidebarItemContainsLink(item, activeLink);

  return (
    <Collapsible.Root defaultOpen={shouldStartOpen}>
      <Collapsible.Trigger
        width="100%"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px="xs"
        py="2px"
        borderRadius="sm"
        textAlign="left"
        _hover={{ bg: "bg.muted" }}
        onClick={() => {
          if (item.link) {
            onSelectLink(item.link);
          }
        }}
      >
        <Text color="fg" textStyle={depth === 0 ? "paragraph/S/medium" : "paragraph/S/regular"}>
          {item.text}
        </Text>
        <Collapsible.Indicator transition="transform 0.2s" _open={{ transform: "rotate(90deg)" }}>
          <ChevronRight size={14} />
        </Collapsible.Indicator>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Stack pl={depth === 0 ? "sm" : "md"} pt="2xs" gap="2xs">
          {children.map((child, index) => (
            <DocsSidebarEntry
              key={`${depth + 1}-${child.text}-${child.link ?? index}`}
              item={child}
              activeLink={activeLink}
              depth={depth + 1}
              onSelectLink={onSelectLink}
            />
          ))}
        </Stack>
      </Collapsible.Content>
    </Collapsible.Root>
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
        <Menu.Root>
          <Stack gap="sm" aria-label="Docs file navigation">
            {menuItems.map((item, index) => (
              <DocsSidebarEntry
                key={`${item.text}-${item.link ?? index}`}
                item={item}
                activeLink={activeLink}
                depth={0}
                onSelectLink={onSelectLink}
              />
            ))}
          </Stack>
        </Menu.Root>
      )}
    </PanelMenu>
  );
};
