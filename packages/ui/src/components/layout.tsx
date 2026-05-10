import { Flex, Splitter, Stack } from "@chakra-ui/react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { HorizontalMenuStack } from "@/components/horizontal-menu-stack";
import { PANEL_HEADER_HEIGHT } from "@/components/panel-header.constants";
import { ScrollArea } from "@/components/scroll-area";
import { useSidebarStore } from "@/components/sidebar/sidebar.store";
import { resolveSidebarResizeEnd, resolveSidebarSplitterSize } from "@/components/sidebar/sidebar-splitter";
import { Toaster } from "@/components/toaster";

export const Layout = () => {
  const { location } = useRouterState();
  return (
    <>
      <Stack flex="1" minH="100vh" gap="0" overflow="hidden">
        <Flex flex="1" height="100%" alignItems="stretch" overflow="hidden">
          <ScrollArea flex="1" bg="bg" contentProps={{ minH: "100%" }}>
            <ErrorBoundary key={location.pathname} label="Unable to render this page.">
              <Outlet />
            </ErrorBoundary>
          </ScrollArea>
        </Flex>
      </Stack>
      <Toaster />
    </>
  );
};

interface PanelLayoutProps {
  sidebar?: React.ReactNode;
  sidebarStorageKey?: string;
  sidebarClosable?: boolean;
  sidebarDefaultWidth?: number;
  sidebarMinWidth?: number;
  sidebarMaxWidth?: number;
  errorLabel?: string;
  children?: React.ReactNode;
}

const DEFAULT_SIDEBAR_WIDTH = 240;
const DEFAULT_SIDEBAR_MIN_WIDTH = 200;
const DEFAULT_SIDEBAR_MAX_WIDTH = 480;

export const PanelLayout = (props: PanelLayoutProps) => {
  const { sidebar, sidebarStorageKey, errorLabel, children } = props;

  if (sidebar && sidebarStorageKey) {
    return <SplitterPanelLayout {...props} sidebar={sidebar} sidebarStorageKey={sidebarStorageKey} />;
  }

  return (
    <Flex height="100%" width="100%" minH="0" minW="0">
      {sidebar ? (
        <Flex minH="0" flexShrink={0}>
          {sidebar}
        </Flex>
      ) : null}
      <ErrorBoundary label={errorLabel ?? "Unable to render the panel."}>
        <Flex flex="1" overflow="hidden" minH="0" minW="0">
          {children ?? <Outlet />}
        </Flex>
      </ErrorBoundary>
    </Flex>
  );
};

interface SplitterPanelLayoutProps extends PanelLayoutProps {
  sidebar: React.ReactNode;
  sidebarStorageKey: string;
}

const SplitterPanelLayout = (props: SplitterPanelLayoutProps) => {
  const {
    sidebar,
    sidebarStorageKey,
    sidebarClosable = true,
    sidebarDefaultWidth = DEFAULT_SIDEBAR_WIDTH,
    sidebarMinWidth = DEFAULT_SIDEBAR_MIN_WIDTH,
    sidebarMaxWidth = DEFAULT_SIDEBAR_MAX_WIDTH,
    errorLabel,
    children,
  } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const open = useSidebarStore(sidebarStorageKey, (state) => state.open);
  const openSidebar = useSidebarStore(sidebarStorageKey, (state) => state.openSidebar);
  const closeSidebar = useSidebarStore(sidebarStorageKey, (state) => state.closeSidebar);
  const persistedWidth = useSidebarStore(sidebarStorageKey, (state) => state.width, { width: sidebarDefaultWidth });
  const setSidebarWidth = useSidebarStore(sidebarStorageKey, (state) => state.setWidth, { width: sidebarDefaultWidth });
  const [size, setSize] = useState<number[]>([20, 80]);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_SIDEBAR_WIDTH * 4);

  useEffect(() => {
    const panelWidth = panelRef.current?.getBoundingClientRect().width ?? 0;

    if (panelWidth === 0) return;

    setPanelWidth(panelWidth);

    if (!open && sidebarClosable) {
      setSize([0, 100]);
      return;
    }

    setSize(
      resolveSidebarSplitterSize({
        panelWidth,
        sidebarWidth: persistedWidth ?? sidebarDefaultWidth,
        minWidth: sidebarMinWidth,
        maxWidth: sidebarMaxWidth,
      }),
    );
  }, [open, persistedWidth, sidebarClosable, sidebarDefaultWidth, sidebarMaxWidth, sidebarMinWidth]);

  return (
    <Splitter.Root
      ref={panelRef}
      height="100%"
      width="100%"
      minH="0"
      minW="0"
      panels={[
        {
          id: "sidebar",
          collapsible: sidebarClosable,
          collapsedSize: 0,
          minSize: sizeFromWidth(sidebarMinWidth, panelWidth),
          maxSize: sizeFromWidth(sidebarMaxWidth, panelWidth),
        },
        { id: "content", minSize: 20 },
      ]}
      size={size}
      onCollapse={closeSidebar}
      onExpand={openSidebar}
      onResize={(details) => setSize(details.size)}
      onResizeEnd={(details) => {
        const panelWidth = panelRef.current?.getBoundingClientRect().width ?? 0;

        if (panelWidth === 0) return;

        const result = resolveSidebarResizeEnd({
          panelWidth,
          sidebarSize: details.size[0] ?? 0,
          minWidth: sidebarMinWidth,
        });

        if (result.type === "collapse") {
          if (sidebarClosable) closeSidebar();
          return;
        }

        setSidebarWidth(result.width);
      }}
    >
      <Splitter.Panel id="sidebar">
        <Flex minH="0" height="100%" width="100%">
          {sidebar}
        </Flex>
      </Splitter.Panel>
      <Splitter.ResizeTrigger id="sidebar:content" aria-label="Resize sidebar" />
      <Splitter.Panel id="content">
        <ErrorBoundary label={errorLabel ?? "Unable to render the panel."}>
          <Flex flex="1" overflow="hidden" minH="0" minW="0" height="100%">
            {children ?? <Outlet />}
          </Flex>
        </ErrorBoundary>
      </Splitter.Panel>
    </Splitter.Root>
  );
};

const sizeFromWidth = (width: number, panelWidth: number) => (width / panelWidth) * 100;

interface PanelSectionLayoutProps {
  actions: React.ReactNode;
  content: React.ReactNode;
}

export const PanelSectionLayout = (props: PanelSectionLayoutProps) => {
  const { actions, content } = props;
  return (
    <Stack height="100%" width="100%" gap="0" minH="0">
      <HorizontalMenuStack
        data-testid="panel-section-actions"
        align="flex-start"
        minH={PANEL_HEADER_HEIGHT}
        flexWrap="wrap"
        gap="sm"
        py="2xs"
      >
        {actions}
      </HorizontalMenuStack>
      <ScrollArea flex="1" bg="bg" contentProps={{ minH: "100%" }}>
        <ErrorBoundary label="Unable to render the panel.">
          <Flex flex="1" overflow="hidden" minH="0">
            {content}
          </Flex>
        </ErrorBoundary>
      </ScrollArea>
    </Stack>
  );
};
