import { Flex, Stack } from "@chakra-ui/react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/error-boundary";
import { HorizontalMenuStack } from "@/components/horizontal-menu-stack";
import { PANEL_HEADER_HEIGHT } from "@/components/panel-header.constants";
import { ScrollArea } from "@/components/scroll-area";
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
  errorLabel?: string;
  children?: React.ReactNode;
}

export const PanelLayout = (props: PanelLayoutProps) => {
  const { sidebar, errorLabel, children } = props;

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
