import { Circle, Flex, HStack, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import { Breadcrumb, type BreadcrumbItem, ListRow, Tooltip } from "@pstdio/ui";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronsUpDown, Copy, PanelLeft } from "lucide-react";
import { type LandingView, PROJECT_TABS, type ProjectTabId, VIEW_META } from "./landing-content";

interface WorkbenchNavProps {
  activeTab: ProjectTabId;
  activeView: LandingView;
  docPath?: string;
  resourceMarkdown?: string;
  resourceTitle?: string;
  sidebarAvailable: boolean;
  sidebarOpen: boolean;
  showPostListOpener: boolean;
  onSelectTab: (tab: ProjectTabId) => void;
  onNavigate: (view: LandingView) => void;
  onNavigateDoc: (path: string) => void;
  onOpenNavigation: () => void;
  onOpenPostList: () => void;
  onToggleSidebar: () => void;
}

const crumbTitle = (Icon: (typeof VIEW_META)[LandingView]["icon"], label: string) => (
  <HStack gap="6px" minWidth="0">
    <Icon size={14} />
    <Text truncate>{label}</Text>
  </HStack>
);

const folderLabel = (segment: string) =>
  segment
    .replace(/[-_]+/g, " ")
    .replace(/\b(api|sdk|cli|adr)s?\b/gi, (value) => value.toUpperCase())
    .replace(/^\w/, (character) => character.toUpperCase());

const buildBreadcrumbs = (props: WorkbenchNavProps): BreadcrumbItem[] => {
  const { activeTab, activeView, docPath, resourceTitle, onNavigate, onNavigateDoc } = props;
  const activeProjectTab = PROJECT_TABS.find((tab) => tab.id === activeTab) ?? PROJECT_TABS[0];

  if (activeTab !== "docs") {
    return [{ title: crumbTitle(activeProjectTab.icon, activeProjectTab.label) }, { title: "Release plan" }];
  }

  const items: BreadcrumbItem[] = [
    {
      title: crumbTitle(activeProjectTab.icon, activeProjectTab.label),
      onClick: activeView === "start" ? undefined : () => onNavigate("start"),
    },
  ];

  if (activeView === "documentation") {
    const segments = (docPath ?? "index.md").replace(/\.md$/, "").split("/");
    const filename = segments.pop();
    items.push({
      title: "Documentation",
      onClick: docPath === "index.md" ? undefined : () => onNavigateDoc("index.md"),
    });
    for (const segment of segments) items.push({ title: folderLabel(segment) });
    if (filename !== "index" || segments.length === 0)
      items.push({ title: resourceTitle ?? folderLabel(filename ?? "Overview") });
    return items;
  }

  const viewMeta = VIEW_META[activeView];
  items.push({ title: crumbTitle(viewMeta.icon, resourceTitle ?? viewMeta.label) });
  return items;
};

export const WorkbenchNav = (props: WorkbenchNavProps) => {
  const {
    activeTab,
    activeView,
    resourceMarkdown,
    sidebarAvailable,
    sidebarOpen,
    showPostListOpener,
    onSelectTab,
    onNavigate,
    onOpenNavigation,
    onOpenPostList,
    onToggleSidebar,
  } = props;

  const viewMeta = VIEW_META[activeView];
  const activeProjectTab = PROJECT_TABS.find((tab) => tab.id === activeTab) ?? PROJECT_TABS[0];
  const MobileIcon = activeTab === "docs" ? viewMeta.icon : activeProjectTab.icon;
  const mobileLabel = activeTab === "docs" ? viewMeta.label : activeProjectTab.label;
  const breadcrumbs = buildBreadcrumbs(props);

  return (
    <>
      <HStack
        as="button"
        aria-label="Open workbench navigation"
        height="40px"
        flexShrink="0"
        width="100%"
        gap="9px"
        px="16px"
        bg="bg.subtle"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        display={{ base: "flex", md: "none" }}
        onClick={onOpenNavigation}
      >
        <MobileIcon size={14} />
        <Text fontFamily="heading" fontWeight="medium" fontSize="13px">
          {mobileLabel}
        </Text>
      </HStack>
      <HStack
        height="40px"
        flexShrink="0"
        gap="5px"
        px="10px"
        bg="bg.subtle"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        display={{ base: "none", md: "flex" }}
      >
        <Tooltip content="Back">
          <IconButton aria-label="Back" variant="ghost" size="xs" onClick={() => window.history.back()}>
            <ArrowLeft size={13} />
          </IconButton>
        </Tooltip>
        <Tooltip content="Forward">
          <IconButton aria-label="Forward" variant="ghost" size="xs" onClick={() => window.history.forward()}>
            <ArrowRight size={13} />
          </IconButton>
        </Tooltip>

        <HStack
          as="button"
          aria-label="Go to Prompt Studio home"
          height="28px"
          px="6px"
          gap="8px"
          rounded="4px"
          _hover={{ bg: "bg.hover" }}
          onClick={() => onNavigate("start")}
        >
          <Circle size="24px" bg="bg.hover">
            <Text fontFamily="heading" fontWeight="medium" fontSize="10px" color="fg.muted">
              P
            </Text>
          </Circle>
          <Text fontFamily="heading" fontWeight="medium" fontSize="13px" whiteSpace="nowrap">
            Prompt Studio
          </Text>
        </HStack>

        <Menu.Root lazyMount closeOnSelect positioning={{ placement: "bottom-start" }}>
          <Menu.Trigger asChild>
            <IconButton aria-label="Switch project" variant="ghost" size="xs">
              <ChevronsUpDown size={14} />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content minW="14rem">
                {PROJECT_TABS.map((tab) => (
                  <Menu.Item key={tab.label} value={tab.label} asChild>
                    <ListRow
                      variant="full-width"
                      icon={<tab.icon size={14} />}
                      label={tab.label}
                      isSelected={tab.id === activeTab}
                      onClick={() => onSelectTab(tab.id)}
                    />
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>

        <Text color="fg.subtle" fontSize="13px">
          /
        </Text>
        <Breadcrumb items={breadcrumbs} separator="/" separatorGap="6px" minWidth="0" fontSize="13px" />

        {resourceMarkdown && (
          <Menu.Root lazyMount closeOnSelect positioning={{ placement: "bottom-start" }}>
            <Menu.Trigger asChild>
              <IconButton aria-label="Page actions" variant="ghost" size="xs">
                <ChevronDown size={13} />
              </IconButton>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content minW="14rem">
                  <Menu.Item value="copy-markdown" asChild>
                    <ListRow
                      variant="full-width"
                      icon={<Copy size={14} />}
                      label="Copy markdown"
                      onClick={() => navigator.clipboard.writeText(resourceMarkdown)}
                    />
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        )}

        <Flex flex="1" />

        {showPostListOpener && (
          <Tooltip content="Open post list">
            <IconButton aria-label="Open post list" variant="ghost" size="xs" onClick={onOpenPostList}>
              <PanelLeft size={14} />
            </IconButton>
          </Tooltip>
        )}
        {sidebarAvailable && !sidebarOpen && (
          <Tooltip content="Open sidebar">
            <IconButton aria-label="Open sidebar" variant="ghost" size="2xs" onClick={onToggleSidebar}>
              <PanelLeft size={13} />
            </IconButton>
          </Tooltip>
        )}
      </HStack>
    </>
  );
};
