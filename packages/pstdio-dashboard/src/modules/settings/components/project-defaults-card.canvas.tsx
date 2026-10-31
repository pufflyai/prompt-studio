import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectDefaultsCard } from "./project-defaults-card";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const meta: CanvasMeta<typeof ProjectDefaultsCard> = {
  title: "ProjectSettings/ProjectDefaultsCard",
  component: ProjectDefaultsCard,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
};
export default meta;
type Story = CanvasFrame<typeof ProjectDefaultsCard>;
export const Default: Story = {
  id: "projectsettings-projectdefaultscard--default",
  args: {
    projectId: "project-1",
  },
};
