import { Box } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { selectDashboardProject } from "@/shared/app/project-context";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { createSessionBubbleModule } from "../bubble/module";
import { openDashboardSidePanel } from "../bubble/open-side-panel";
import { openSessionBubbleWidgets } from "../bubble/session-bubble";

const draftResource = {
  type: "session-draft",
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
const SessionChatDraftStory = (props: { initiallyClosed?: boolean }) => {
  const { initiallyClosed = false } = props;
  const [workbench] = useState(() => {
    const workbench = createWorkbench({ initialSidePanelMode: initiallyClosed ? "closed" : "attached" });
    workbench.registerModule(createSessionBubbleModule({ sessionDraftPersistence: drafts }));
    selectDashboardProject(workbench, { id: "project-story", name: "Prompt Studio" });
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
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SessionChatDraftStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PreviewWithRestoredDraft: Story = {};
export const OpenFromBubble: Story = {
  args: { initiallyClosed: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Open Side Panel" }));
    await expect(await canvas.findByRole("tab", { name: "New session" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Close Side Panel" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Open Side Panel" }));
    await expect(canvas.getAllByRole("tab", { name: "New session" })).toHaveLength(1);
  },
};
