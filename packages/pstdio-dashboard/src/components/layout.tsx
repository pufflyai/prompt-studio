import { Flex } from "@chakra-ui/react";
import { Toaster } from "@pstdio/ui";
import { Outlet } from "@tanstack/react-router";
import { usePageTitle } from "@/features/page-title/hooks/use-page-title";

export const Layout = () => {
  usePageTitle();

  return (
    <Flex h="100vh" w="100vw">
      <Flex flex="1" minW={0} direction="column">
        <Outlet />
      </Flex>
      <Toaster />
    </Flex>
  );
};
