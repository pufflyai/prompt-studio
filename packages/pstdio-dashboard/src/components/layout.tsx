import { Flex } from "@chakra-ui/react";
import { Toaster } from "@pstdio/ui";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { getPageTitle } from "@/features/page-title/utils/page-title";
import { BackendConnectionDot } from "@/features/sync/backend-connection-dot";
import { useBackendConnectionStatus } from "@/features/sync/sync-provider";

export const Layout = () => {
  const connectionStatus = useBackendConnectionStatus();
  const { location } = useRouterState();

  useEffect(() => {
    document.title = getPageTitle(location.pathname);
  }, [location.pathname]);

  return (
    <Flex h="100vh" w="100vw">
      <Flex flex="1" minW={0} direction="column">
        <Outlet />
      </Flex>
      <BackendConnectionDot status={connectionStatus} />
      <Toaster />
    </Flex>
  );
};
