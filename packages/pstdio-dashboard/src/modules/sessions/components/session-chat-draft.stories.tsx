import { Box } from "@chakra-ui/react";
import { createWorkbenchCore } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { selectDashboardProject } from "@/shared/app/project-context";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { createSessionBubbleModule } from "../bubble/module";
import { openSessionBubbleWidgets } from "../bubble/session-bubble";

const draftResource = {
  kind: "session-draft",
  uri: "dashboard-workbench://session-draft/story-preview",
  id: "story-preview",
  label: "New session",
  icon: "PenBox",
};

const drafts: DashboardSessionDraftPersistence = {
  getDraft: (draftKey) => (draftKey === draftResource.id ? "Keep the restored Side Panel attached after refresh." : ""),
  setDraft: () => undefined,
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const SessionChatDraftStory = () => {
  const workbench = createWorkbenchCore({ initialSidePanelMode: "attached" });
  workbench.registerModule(createSessionBubbleModule({ sessionDraftPersistence: drafts }));
  selectDashboardProject(workbench, { id: "project-story", name: "Prompt Studio" });
  openSessionBubbleWidgets(workbench, { resource: draftResource });

  return (
    <QueryClientProvider client={queryClient}>
      <Box h="100dvh" w="full">
        <Workbench workbench={workbench} />
      </Box>
    </QueryClientProvider>
  );
};

const meta = {
  title: "Modules/Sessions/Session Chat Draft",
  component: SessionChatDraftStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SessionChatDraftStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PreviewWithRestoredDraft: Story = {};
