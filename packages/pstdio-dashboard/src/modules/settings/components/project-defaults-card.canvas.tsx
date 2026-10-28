import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectDefaultsCard } from "./project-defaults-card";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const meta: Meta<typeof ProjectDefaultsCard> = {
  title: "ProjectSettings/ProjectDefaultsCard",
  component: ProjectDefaultsCard,
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

type Story = StoryObj<typeof ProjectDefaultsCard>;

export const Default: Story = {
  args: {
    projectId: "project-1",
  },
};
