import { Box, Flex } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WorkspaceShellTabs } from "./workspace-shell-tabs";

type StoryFn = () => ReactNode;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const meta = {
  title: "Workspaces/WorkspaceShellTabs",
  component: WorkspaceShellTabs,
  decorators: [
    (Story: StoryFn) => (
      <QueryClientProvider client={queryClient}>
        <Flex height="75vh" border="1px solid" borderColor="border.muted" borderRadius="md" overflow="hidden">
          <Box flex="1" minW="0">
            <Story />
          </Box>
        </Flex>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof WorkspaceShellTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ExtensionChangesTab: Story = {
  args: {
    projectId: undefined,
    ticketId: "ticket-1",
    workspaceId: null,
    artifacts: [],
    selectedTab: "changes",
    onTabChange: () => undefined,
  },
};
