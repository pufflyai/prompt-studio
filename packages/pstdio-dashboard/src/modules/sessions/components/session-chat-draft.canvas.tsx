import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { selectDashboardProject } from "@/shared/app/project-context";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { openSessionsPage, openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionBubbleModule } from "../bubble/module";
import { openDashboardSidePanel } from "../bubble/open-side-panel";
import { openSessionBubbleWidgets } from "../bubble/session-bubble";
import { createSessionsModule } from "../module";

const draftResource = {
  type: "session-draft",
  id: "story-preview",
  label: "New session",
  icon: "MessageSquarePlus",
};
const emptyAttachments = { attachments: [], uploading: false };
const drafts: DashboardSessionDraftPersistence = {
  getDraft: (draftKey) => (draftKey === draftResource.id ? "Keep the restored Side Panel attached after refresh." : ""),
  setDraft: () => undefined,
  getAttachmentDraft: () => ({
    getSnapshot: () => emptyAttachments,
    subscribe: () => () => undefined,
    changeAttachments: () => undefined,
    changeUploading: () => undefined,
  }),
};
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const SessionChatDraftStory = (props: { initiallyClosed?: boolean; showMain?: boolean }) => {
  const { initiallyClosed = false, showMain = false } = props;
  const [workbench] = useState(() => {
    const workbench = createWorkbench({ initialSidePanelMode: initiallyClosed ? "closed" : "attached" });
    workbench.registerModule(createWorkspacesModule());
    if (showMain) workbench.registerModule(createSessionsModule({ sessionDraftPersistence: drafts }));
    else workbench.registerModule(createSessionBubbleModule({ sessionDraftPersistence: drafts }));
    selectDashboardProject(workbench, { id: "project-story", name: "Prompt Studio" });
    if (showMain) openSessionsPage(workbench);
    else openWorkspacesPage(workbench);
    if (showMain) workbench.shell.setRegionOpen("secondary", false);
    if (!initiallyClosed) openSessionBubbleWidgets(workbench, { resource: draftResource });
    return workbench;
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Box h="100dvh" w="full">
        <Workbench workbench={workbench} onOpenSidePanel={() => void openDashboardSidePanel(workbench)} />
      </Box>
    </QueryClientProvider>
  );
};
const meta = {
  title: "Modules/Sessions/Session Chat Draft",
  component: SessionChatDraftStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof SessionChatDraftStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const PreviewWithRestoredDraft: Story = {
  id: "modules-sessions-session-chat-draft--preview-with-restored-draft",
};
export const MainAndSidePanels: Story = {
  id: "modules-sessions-session-chat-draft--main-and-side-panels",
  args: { showMain: true },
  description:
    "Main and side chat views share the same bottom inset, with no gap between workspace headers and inputs.",
};
export const OpenFromBubble: Story = {
  id: "modules-sessions-session-chat-draft--open-from-bubble",
  args: { initiallyClosed: true },
};
