import { Flex, Stack } from "@chakra-ui/react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/error-boundary";
import { HorizontalMenuStack } from "@/components/horizontal-menu-stack";
import { PanelMenu } from "@/components/panel-menu";
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
  title: string;
  menuContent?: React.ReactNode;
  errorLabel?: string;
  children?: React.ReactNode;
}

export const PanelLayout = (props: PanelLayoutProps) => {
  const { title, menuContent, errorLabel, children } = props;

  return (
    <Flex height="100%" width="100%" minH="0">
      <PanelMenu title={title}>{menuContent}</PanelMenu>
      <ErrorBoundary label={errorLabel ?? "Unable to render the panel."}>
        <Flex flex="1" overflow="hidden" minH="0">
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
      <HorizontalMenuStack align="flex-start" flexWrap="wrap" gap="sm">
        {actions}
      </HorizontalMenuStack>
      <ErrorBoundary label="Unable to render the panel.">
        <Flex flex="1" overflow="hidden" minH="0">
          {content}
        </Flex>
      </ErrorBoundary>
    </Stack>
  );
};
