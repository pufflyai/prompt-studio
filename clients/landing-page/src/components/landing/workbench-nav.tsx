import { Circle, Flex, HStack, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import { ListRow, Tooltip } from "@pstdio/ui";
import { ChevronDown, ChevronsUpDown, Copy, PanelLeft } from "lucide-react";
import { type LandingView, NAVIGATION_GROUP_META, PROJECT_TABS, type ProjectTabId, VIEW_META } from "./landing-content";

interface WorkbenchNavProps {
  activeTab: ProjectTabId;
  activeView: LandingView;
  resourceMarkdown?: string;
  resourceTitle?: string;
  sidebarOpen: boolean;
  showPostListOpener: boolean;
  onSelectTab: (tab: ProjectTabId) => void;
  onNavigate: (view: LandingView) => void;
  onOpenNavigation: () => void;
  onOpenPostList: () => void;
  onToggleSidebar: () => void;
}

export const WorkbenchNav = (props: WorkbenchNavProps) => {
  const {
    activeTab,
    activeView,
    resourceMarkdown,
    resourceTitle,
    sidebarOpen,
    showPostListOpener,
    onSelectTab,
    onNavigate,
    onOpenNavigation,
    onOpenPostList,
    onToggleSidebar,
  } = props;

  const viewMeta = VIEW_META[activeView];
  const parentMeta = activeTab === "docs" && viewMeta.parent ? NAVIGATION_GROUP_META[viewMeta.parent] : undefined;
  const activeProjectTab = PROJECT_TABS.find((tab) => tab.id === activeTab) ?? PROJECT_TABS[0];
  const hasResourceTitle = activeTab === "docs" && Boolean(resourceTitle && resourceTitle !== viewMeta.label);
  const MobileIcon = activeTab === "docs" ? viewMeta.icon : activeProjectTab.icon;
  const mobileLabel = activeTab === "docs" ? viewMeta.label : activeProjectTab.label;

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
        {!sidebarOpen && (
          <Tooltip content="Open sidebar">
            <IconButton
              aria-label="Open sidebar"
              variant="ghost"
              size="2xs"
              display={{ base: "none", lg: "inline-flex" }}
              onClick={onToggleSidebar}
            >
              <PanelLeft size={13} />
            </IconButton>
          </Tooltip>
        )}

        <Menu.Root lazyMount closeOnSelect positioning={{ placement: "bottom-start" }}>
          <Menu.Trigger asChild>
            <HStack
              as="button"
              cursor="pointer"
              height="28px"
              px="8px"
              gap="8px"
              rounded="4px"
              _hover={{ bg: "bg.hover" }}
            >
              <Circle size="24px" bg="bg.hover">
                <Text fontFamily="heading" fontWeight="medium" fontSize="10px" color="fg.muted">
                  P
                </Text>
              </Circle>
              <Text fontFamily="heading" fontWeight="medium" fontSize="13px" whiteSpace="nowrap">
                Prompt Studio
              </Text>
              <ChevronsUpDown size={14} />
            </HStack>
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

        {parentMeta && (
          <HStack gap="2px" display={{ base: "none", md: "flex" }}>
            <Text fontFamily="body" fontSize="13px" color="fg.subtle">
              /
            </Text>
            <HStack
              as={parentMeta.overview ? "button" : "div"}
              cursor={parentMeta.overview ? "pointer" : undefined}
              height="28px"
              px="8px"
              gap="6px"
              rounded="4px"
              color="fg.muted"
              _hover={parentMeta.overview ? { bg: "bg.hover", color: "fg" } : undefined}
              onClick={() => parentMeta.overview && onNavigate(parentMeta.overview)}
            >
              <parentMeta.icon size={14} />
              <Text fontFamily="body" fontSize="13px" whiteSpace="nowrap">
                {parentMeta.label}
              </Text>
            </HStack>
          </HStack>
        )}
        {hasResourceTitle && (
          <HStack gap="2px" display={{ base: "none", md: "flex" }}>
            <Text fontFamily="body" fontSize="13px" color="fg.subtle">
              /
            </Text>
            <HStack height="28px" px="8px" gap="6px" rounded="4px" color="fg.muted">
              <viewMeta.icon size={14} />
              <Text fontFamily="body" fontSize="13px" whiteSpace="nowrap">
                {viewMeta.label}
              </Text>
            </HStack>
          </HStack>
        )}

        <HStack gap="2px" display={activeTab === "docs" ? { base: "none", md: "flex" } : "none"}>
          <Text fontFamily="body" fontSize="13px" color="fg.subtle">
            /
          </Text>
          {resourceMarkdown ? (
            <Menu.Root lazyMount closeOnSelect positioning={{ placement: "bottom-start" }}>
              <Menu.Trigger asChild>
                <HStack
                  as="button"
                  aria-label="Page actions"
                  cursor="pointer"
                  height="28px"
                  px="8px"
                  gap="4px"
                  rounded="4px"
                  minWidth="0"
                  _hover={{ bg: "bg.hover" }}
                >
                  {!hasResourceTitle && <viewMeta.icon size={14} />}
                  <Text fontFamily="body" fontWeight="medium" fontSize="13px" whiteSpace="nowrap" truncate>
                    {resourceTitle ?? viewMeta.label}
                  </Text>
                  <ChevronDown size={13} />
                </HStack>
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
          ) : (
            <HStack height="28px" px="8px" gap="4px" minWidth="0">
              {!hasResourceTitle && <viewMeta.icon size={14} />}
              <Text fontFamily="body" fontWeight="medium" fontSize="13px" whiteSpace="nowrap" truncate>
                {resourceTitle ?? viewMeta.label}
              </Text>
            </HStack>
          )}
        </HStack>

        <Flex flex="1" />

        {showPostListOpener && (
          <Tooltip content="Open post list">
            <IconButton aria-label="Open post list" variant="ghost" size="xs" onClick={onOpenPostList}>
              <PanelLeft size={14} />
            </IconButton>
          </Tooltip>
        )}
      </HStack>
    </>
  );
};
