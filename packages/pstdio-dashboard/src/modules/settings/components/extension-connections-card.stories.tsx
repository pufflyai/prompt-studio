import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExtensionConnectionsCard } from "./extension-connections-card";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } } });
queryClient.setQueryData(["extension-connections", "project-1"], {
  connections: [
    {
      id: "connection-1",
      extensionId: "pstdio.remote",
      connectionId: "control-plane",
      baseUrl: "https://control.example.test",
      authType: "bearer",
      configured: true,
      lastCheck: { ok: true, status: 200, error: null, checkedAt: "2026-08-26T08:00:00.000Z" },
      updatedAt: "2026-08-26T08:00:00.000Z",
    },
  ],
});

const definitions: NonNullable<WorkbenchExtensionMetadata["connections"]> = [
  {
    id: "pstdio.remote.connection.control-plane",
    localId: "control-plane",
    extensionId: "pstdio.remote",
    label: "Control plane",
    authType: "bearer",
    supportsCheck: true,
  },
];

const meta: Meta<typeof ExtensionConnectionsCard> = {
  title: "ProjectSettings/ExtensionConnectionsCard",
  component: ExtensionConnectionsCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ExtensionConnectionsCard>;

export const Connected: Story = { args: { projectId: "project-1", definitions } };
