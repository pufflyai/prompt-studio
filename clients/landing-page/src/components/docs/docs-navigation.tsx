import { Box, Button, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, TreeList, type TreeListNavigateEvent, type TreeListNode, type TreeListSection } from "@pstdio/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

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

const DOCS_SECTION_ID = "docs-nav";

const buildItemId = (item: DocsSidebarItem, parentId: string, index: number) =>
  item.link ?? `${parentId}/${item.text}-${index}`;

const buildNodes = (items: DocsSidebarItem[], parentId: string): TreeListNode[] =>
  items.map((item, index) => {
    const id = buildItemId(item, parentId, index);
    const childItems = item.items ?? [];

    if (childItems.length > 0) {
      return {
        id,
        label: item.text,
        children: buildNodes(childItems, id),
      };
    }

    return {
      id,
      label: item.text,
      disabled: !item.link,
      isNavigable: Boolean(item.link),
      navigationIntent: item.link ? { id: "select-link", payload: item.link } : undefined,
    };
  });

const collectInitialExpandedIds = (
  items: DocsSidebarItem[],
  parentId: string,
  shouldStartOpen?: (item: DocsSidebarItem) => boolean,
): string[] => {
  const result: string[] = [];

  items.forEach((item, index) => {
    const id = buildItemId(item, parentId, index);
    const childItems = item.items ?? [];

    if (childItems.length === 0) return;

    if (shouldStartOpen?.(item)) {
      result.push(id);
    }
    result.push(...collectInitialExpandedIds(childItems, id, shouldStartOpen));
  });

  return result;
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

  const sections: TreeListSection[] = [
    { id: DOCS_SECTION_ID, collapsible: false, nodes: buildNodes(menuItems, "root") },
  ];

  const initialExpanded = collectInitialExpandedIds(menuItems, "root", shouldStartOpen);
  const [expanded, setExpanded] = useState<string[]>(initialExpanded);

  useEffect(() => {
    setExpanded(initialExpanded);
  }, [initialExpanded]);

  const handleNavigate = (event: TreeListNavigateEvent) => {
    if (event.intent?.id !== "select-link") return;
    onSelectLink(event.intent.payload as string);
  };

  const handleToggleNode = (nodeId: string) => {
    setExpanded((prev) => (prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]));
  };

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
          <TreeList
            sections={sections}
            activeNodeId={activeLink}
            expandedNodeIds={expanded}
            rowVariant="tree"
            onNavigate={handleNavigate}
            onToggleNode={handleToggleNode}
          />
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
