import { Flex } from "@chakra-ui/react";
import { Toaster } from "@pstdio/ui";
import { Outlet } from "@tanstack/react-router";
import { usePageTitle } from "@/features/page-title/hooks/use-page-title";
import { ProjectPickerProvider } from "@/features/project-list/components/project-picker-provider";

export const Layout = () => {
  usePageTitle();

  return (
    <ProjectPickerProvider>
      <Flex h="100vh" w="100vw">
        <Flex flex="1" minW={0} direction="column">
          <Outlet />
        </Flex>
        <Toaster />
      </Flex>
    </ProjectPickerProvider>
  );
};
