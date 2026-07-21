import { Circle, Flex, HStack, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import { ListRow, Tooltip } from "@pstdio/ui";
import { BookOpen, ChevronDown, ChevronsUpDown, Copy, GitBranch, Link as LinkIcon, PanelLeft } from "lucide-react";
import {
  DOCUMENTATION_GROUP_META,
  INSTALL_COMMANDS,
  type LandingView,
  PROJECT_TABS,
  type ProjectTabId,
  VIEW_META,
} from "./landing-content";

interface WorkbenchNavProps {
  activeTab: ProjectTabId;
  activeView: LandingView;
  resourceTitle?: string;
  sidebarOpen: boolean;
  showPostListOpener: boolean;
  onSelectTab: (tab: ProjectTabId) => void;
  onNavigate: (view: LandingView) => void;
  onOpenPostList: () => void;
  onToggleSidebar: () => void;
  onOpenChangelog: () => void;
}

export const WorkbenchNav = (props: WorkbenchNavProps) => {
  const {
    activeTab,
    activeView,
    resourceTitle,
    sidebarOpen,
    showPostListOpener,
    onSelectTab,
    onNavigate,
    onOpenPostList,
    onToggleSidebar,
    onOpenChangelog,
  } = props;

  const viewMeta = VIEW_META[activeView];
  const parentMeta = viewMeta.parent ? DOCUMENTATION_GROUP_META[viewMeta.parent] : undefined;
  const activeProjectTab = PROJECT_TABS.find((tab) => tab.id === activeTab) ?? PROJECT_TABS[0];
  const hasResourceTitle = Boolean(resourceTitle && resourceTitle !== viewMeta.label);

  const resourceActions = [
    {
      id: "copy-link",
      label: "Copy link",
      icon: <LinkIcon size={14} />,
      onAction: () => navigator.clipboard.writeText(window.location.href),
    },
    {
      id: "copy-install",
      label: "Copy install command",
      icon: <Copy size={14} />,
      onAction: () => navigator.clipboard.writeText(INSTALL_COMMANDS.join("\n")),
    },
    {
      id: "open-docs",
      label: "Open docs",
      icon: <BookOpen size={14} />,
      onAction: () => onNavigate("concepts"),
    },
    {
      id: "view-changelog",
      label: "View changelog",
      icon: <GitBranch size={14} />,
      onAction: onOpenChangelog,
    },
  ];

  return (
    <HStack height="40px" flexShrink="0" gap="5px" px="10px" bg="bg.subtle">
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
                {activeProjectTab.label[0]}
              </Text>
            </Circle>
            <Text fontFamily="heading" fontWeight="medium" fontSize="13px" whiteSpace="nowrap">
              {activeProjectTab.label}
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

      <Menu.Root lazyMount closeOnSelect positioning={{ placement: "bottom-start" }}>
        <HStack gap="2px" display={{ base: "none", md: "flex" }}>
          <Text fontFamily="body" fontSize="13px" color="fg.subtle">
            /
          </Text>
          <Menu.Trigger asChild>
            <HStack
              as="button"
              aria-label="Resource actions"
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
        </HStack>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="14rem">
              {resourceActions.map((action) => (
                <Menu.Item key={action.id} value={action.id} asChild>
                  <ListRow variant="full-width" icon={action.icon} label={action.label} onClick={action.onAction} />
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      <Flex flex="1" />

      {showPostListOpener && (
        <Tooltip content="Open post list">
          <IconButton aria-label="Open post list" variant="ghost" size="2xs" onClick={onOpenPostList}>
            <PanelLeft size={13} />
          </IconButton>
        </Tooltip>
      )}
    </HStack>
  );
};
