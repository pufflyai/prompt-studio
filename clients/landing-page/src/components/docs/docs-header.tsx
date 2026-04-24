import { Box, Button, CloseButton, Dialog, Flex, Input, InputGroup, Menu, Stack, Tabs, Text } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { ArrowRight, BookOpen, FileText, FolderOpen, Library, ListTree, type LucideIcon, Search } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { createCopyFeedbackController } from "../../utils/copy-feedback";
import { CopyCommandIcon } from "../copy-command-icon";
import { normalizeDocsPath } from "./docs-menu";
import type { DocsSidebarItem } from "./docs-navigation";
import { type DocsSearchGroup, type DocsSearchItem, type DocsSearchItemKind, getDocsSearchGroups } from "./docs-search";

type DocsHeaderTab = "Guide" | "References";

interface DocsHeaderProps {
  menuItems: DocsSidebarItem[];
  searchItems: DocsSearchItem[];
  activeLink: string;
  markdown: string;
}

interface DocsSearchDialogProps {
  open: boolean;
  searchItems: DocsSearchItem[];
  onOpenChange: (open: boolean) => void;
}

interface DocsSearchResultGroupProps {
  group: DocsSearchGroup;
}

interface DocsSearchResultProps {
  item: DocsSearchItem;
}

const docsHeaderTabs: { value: DocsHeaderTab; icon: typeof BookOpen }[] = [
  { value: "Guide", icon: BookOpen },
  { value: "References", icon: Library },
];

const docsHeaderFallbackLinks: Record<DocsHeaderTab, string> = {
  Guide: "/docs/",
  References: "/docs/sdk/",
};

const docsSearchItemIcons = {
  category: FolderOpen,
  page: FileText,
  outline: ListTree,
} satisfies Record<DocsSearchItemKind, LucideIcon>;

export const DocsHeader = (props: DocsHeaderProps) => {
  const { menuItems, searchItems, activeLink, markdown } = props;
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const copyFeedbackControllerRef = useRef<ReturnType<typeof createCopyFeedbackController> | null>(null);
  const activeTab = resolveActiveDocsHeaderTab(menuItems, activeLink);

  if (!copyFeedbackControllerRef.current) {
    copyFeedbackControllerRef.current = createCopyFeedbackController(setIsCopied);
  }

  const copyFeedbackController = copyFeedbackControllerRef.current;

  useEffect(() => {
    return () => {
      copyFeedbackController.dispose();
    };
  }, [copyFeedbackController]);

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(markdown.trim());
    copyFeedbackController.markCopied();
  };

  return (
    <Box as="nav" aria-label="Documentation" position="sticky" top="0" zIndex="10" bg="bg">
      <Flex
        gap="3"
        py="3"
        direction={{ base: "column", md: "row" }}
        align={{ base: "stretch", md: "center" }}
        justify="space-between"
      >
        <Flex gap="2" alignItems="center" width={{ base: "full", md: "auto" }}>
          <Button
            type="button"
            variant="outline"
            colorPalette="gray"
            size="sm"
            height="2.5rem"
            flex={{ base: "1", md: "initial" }}
            minW="0"
            width={{ md: "12rem" }}
            justifyContent="flex-start"
            fontWeight="normal"
            color="fg.muted"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={16} />
            Search docs
          </Button>
          <Button
            type="button"
            variant="outline"
            colorPalette="gray"
            size="sm"
            height="2.5rem"
            flexShrink="0"
            fontWeight="normal"
            color="fg.muted"
            aria-label="Copy page markdown"
            onClick={handleCopyMarkdown}
          >
            <CopyCommandIcon isCopied={isCopied} />
            <Box as="span" hideBelow="sm">
              Copy markdown
            </Box>
          </Button>
        </Flex>

        <Tabs.Root value={activeTab} variant="outline" size="sm" colorPalette="gray">
          <Tabs.List width={{ base: "full", md: "auto" }} height="2.5rem" minH="2.5rem">
            {docsHeaderTabs.map((tab) => {
              const Icon = tab.icon;

              return (
                <Tabs.Trigger
                  key={tab.value}
                  value={tab.value}
                  asChild
                  flex={{ base: "1", md: "initial" }}
                  height="2.5rem"
                  minH="2.5rem"
                  px="4"
                  gap="2"
                  textDecoration="none"
                >
                  <a href={getDocsHeaderTabLink(menuItems, tab.value)}>
                    <Icon size={15} />
                    {tab.value}
                  </a>
                </Tabs.Trigger>
              );
            })}
          </Tabs.List>
        </Tabs.Root>
      </Flex>

      <DocsSearchDialog open={isSearchOpen} searchItems={searchItems} onOpenChange={setSearchOpen} />
    </Box>
  );
};

const DocsSearchDialog = (props: DocsSearchDialogProps) => {
  const { open, searchItems, onOpenChange } = props;
  const [searchQuery, setSearchQuery] = useState("");
  const searchGroups = getDocsSearchGroups(searchItems, searchQuery);
  const hasSearchQuery = searchQuery.trim().length > 0;
  let searchResultContent: ReactNode = null;

  if (hasSearchQuery && searchGroups.length === 0) {
    searchResultContent = (
      <Text color="fg.muted" fontSize="sm" px="4" py="6" textAlign="center">
        No docs found
      </Text>
    );
  }

  if (hasSearchQuery && searchGroups.length > 0) {
    searchResultContent = searchGroups.map((group) => <DocsSearchResultGroup key={group.title} group={group} />);
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const firstMatch = searchGroups[0]?.items[0];
    if (!firstMatch) return;

    window.location.href = firstMatch.href;
  };

  const handleOpenChange = (details: { open: boolean }) => {
    onOpenChange(details.open);

    if (!details.open) {
      setSearchQuery("");
    }
  };

  return (
    <Dialog.Root lazyMount open={open} onOpenChange={handleOpenChange}>
      <Dialog.Backdrop bg="blackAlpha.500" backdropFilter="blur(2px)" />
      <Dialog.Positioner alignItems="flex-start" p={{ base: "4", md: "6" }} pt={{ base: "5rem", md: "7rem" }}>
        <Dialog.Content maxW="42rem" width="full" overflow="hidden" borderRadius="md">
          <Dialog.Header px="4" py="3" borderBottomWidth="1px">
            <Dialog.Title srOnly>Search documentation</Dialog.Title>
            <Box as="form" width="full" onSubmit={handleSubmit}>
              <InputGroup
                startElement={<Search size={18} />}
                endElement={
                  <Dialog.CloseTrigger asChild>
                    <CloseButton size="sm" />
                  </Dialog.CloseTrigger>
                }
                endElementProps={{ pe: "2" }}
              >
                <Input
                  autoFocus
                  type="search"
                  size="lg"
                  placeholder="Search documentation"
                  aria-label="Search documentation"
                  borderWidth="0"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  _focusVisible={{ boxShadow: "none" }}
                />
              </InputGroup>
            </Box>
          </Dialog.Header>

          <Dialog.Body p="0">
            <Menu.Root>
              <Stack gap="0" maxH="26rem" overflowY="auto" p="2">
                {searchResultContent}
              </Stack>
            </Menu.Root>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

const DocsSearchResultGroup = (props: DocsSearchResultGroupProps) => {
  const { group } = props;

  return (
    <Stack gap="1" py="1">
      <Text color="fg.subtle" fontSize="xs" fontWeight="semibold" px="3" py="1" textTransform="uppercase">
        {group.title}
      </Text>
      {group.items.map((item) => (
        <DocsSearchResult key={item.id} item={item} />
      ))}
    </Stack>
  );
};

const DocsSearchResult = (props: DocsSearchResultProps) => {
  const { item } = props;
  const Icon = docsSearchItemIcons[item.kind];

  return (
    <MenuItem
      asChild
      id={item.id}
      primaryLabel={item.title}
      secondaryLabel={item.description}
      leftIcon={Icon}
      leftIconColor="fg.muted"
      leftIconSize="16px"
      rightIcon={ArrowRight}
      rightIconColor="fg.subtle"
      rightIconSize="16px"
      width="full"
      maxWidth="none"
    >
      <a href={item.href}>{item.title}</a>
    </MenuItem>
  );
};

function getDocsHeaderTabLink(menuItems: DocsSidebarItem[], tab: DocsHeaderTab) {
  const section = menuItems.find((item) => item.text === tab);

  return findFirstDocsLink(section) ?? docsHeaderFallbackLinks[tab];
}

function resolveActiveDocsHeaderTab(menuItems: DocsSidebarItem[], activeLink: string) {
  const activeTab = docsHeaderTabs.find((tab) => {
    const section = menuItems.find((item) => item.text === tab.value);
    return section ? hasDocsLink(section, activeLink) : false;
  });

  return activeTab?.value ?? "Guide";
}

function findFirstDocsLink(item?: DocsSidebarItem) {
  if (!item) return undefined;
  if (item.link) return item.link;

  const queue = [...(item.items ?? [])];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (current.link) return current.link;
    queue.push(...(current.items ?? []));
  }

  return undefined;
}

function hasDocsLink(item: DocsSidebarItem, activeLink: string) {
  const normalizedActiveLink = normalizeDocsPath(activeLink);
  const queue = [item];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (current.link && normalizeDocsPath(current.link) === normalizedActiveLink) return true;
    queue.push(...(current.items ?? []));
  }

  return false;
}
