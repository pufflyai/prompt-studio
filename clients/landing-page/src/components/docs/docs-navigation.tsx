import { Box, Button, Flex, HStack, Menu, Stack, Text } from "@chakra-ui/react";
import { ItemSection, MenuItem, ScrollArea } from "@pstdio/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface DocsSidebarItem {
  text: string;
  link?: string;
  items?: DocsSidebarItem[];
}

export interface DocsPaginationItem {
  href: string;
  title: string;
  description?: string;
}

interface DocsSidebarEntryProps {
  item: DocsSidebarItem;
  activeLink: string;
  onSelectLink: (link: string) => void;
  shouldStartOpen?: (item: DocsSidebarItem) => boolean;
}

interface DocsSidebarProps {
  title: string;
  emptyMessage?: string;
  menuItems: DocsSidebarItem[];
  activeLink: string;
  onSelectLink: (link: string) => void;
  shouldStartOpen?: (item: DocsSidebarItem) => boolean;
}

interface DocsPaginationProps {
  previous?: DocsPaginationItem;
  next?: DocsPaginationItem;
}

interface DocsPaginationLinkProps {
  item: DocsPaginationItem;
  direction: "prev" | "next";
}

const DocsSidebarEntry = (props: DocsSidebarEntryProps) => {
  const { item, activeLink, onSelectLink, shouldStartOpen } = props;
  const children = item.items ?? [];

  if (children.length === 0 && item.link) {
    return (
      <Menu.Root>
        <MenuItem
          primaryLabel={item.text}
          isSelected={item.link === activeLink}
          variant="compact"
          onClick={() => onSelectLink(item.link!)}
        />
      </Menu.Root>
    );
  }

  if (children.length === 0) {
    return (
      <Menu.Root>
        <MenuItem primaryLabel={item.text} isDisabled variant="compact" />
      </Menu.Root>
    );
  }

  return (
    <ItemSection title={item.text} defaultOpen={shouldStartOpen?.(item) ?? false}>
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

const DocsPaginationLink = (props: DocsPaginationLinkProps) => {
  const { item, direction } = props;
  const isPrevious = direction === "prev";

  return (
    <Button
      asChild
      variant="ghost"
      colorPalette="gray"
      gap="3"
      size="sm"
      h="auto"
      py="2"
      textAlign={isPrevious ? "start" : "end"}
      justifyContent={isPrevious ? "flex-start" : "flex-end"}
      flex="1"
    >
      <a href={item.href}>
        {isPrevious ? <ChevronLeft size={16} /> : null}
        <Stack gap="0" alignItems={isPrevious ? "flex-start" : "flex-end"}>
          <Text textStyle="sm" color="fg.muted" fontWeight="normal">
            {isPrevious ? "Previous" : "Next"}
          </Text>
          <Text textStyle="sm" fontWeight="medium">
            {item.title}
          </Text>
          {item.description ? (
            <Text textStyle="xs" color="fg.subtle" fontWeight="normal">
              {item.description}
            </Text>
          ) : null}
        </Stack>
        {isPrevious ? null : <ChevronRight size={16} />}
      </a>
    </Button>
  );
};

export const DocsSidebar = (props: DocsSidebarProps) => {
  const { title, emptyMessage, menuItems, activeLink, onSelectLink, shouldStartOpen } = props;

  return (
    <Stack borderRightWidth="1px" width="64" gap="0" minH="0">
      <Flex height="49px" p="xs" borderBottomWidth="1px" alignItems="center">
        <Text textStyle="label/L/medium" color="fg.muted">
          {title}
        </Text>
      </Flex>

      <ScrollArea flex="1" minH="0" contentProps={{ p: "2xs", spaceY: "2xs" }}>
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
      </ScrollArea>
    </Stack>
  );
};

export const DocsPagination = (props: DocsPaginationProps) => {
  const { previous, next } = props;

  if (!previous && !next) {
    return null;
  }

  return (
    <HStack justify="space-between" gap="4">
      <Box flex="1">{previous ? <DocsPaginationLink item={previous} direction="prev" /> : null}</Box>
      <Box flex="1">{next ? <DocsPaginationLink item={next} direction="next" /> : null}</Box>
    </HStack>
  );
};
