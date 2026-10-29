import { Box, Text } from "@chakra-ui/react";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { OnboardingState } from "pstdio-api-contracts";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createOnboardingModule } from "./module";

const CreatedProject = (props: { previouslyCompleted: boolean }) => {
  const { previouslyCompleted } = props;
  const [workbench] = useState(() => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.views.registerView({
      id: "project-workspace",
      title: "Workspace",
      body: { kind: "react", render: () => <Text>Workspace</Text> },
    });
    workbench.pages.registerPage({
      id: "start",
      ref: workbenchPages.start,
      title: "Workspace",
      path: "",
      modeId: "project",
      main: { kind: "view", cardinality: "one", presentation: "page", view: { kind: "view", id: "project-workspace" } },
      slots: [],
    });
    selectDashboardProject(workbench, { id: "project-1", name: "Notes" });
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({ kind: "page", page: workbenchPages.start });
    let state: OnboardingState = { completed: previouslyCompleted, hidden: false, harnesses: null, workAreas: null };
    const onboarding = createOnboardingModule({
      read: async () => ({ state, installedExtensions: [], detectedHarnesses: [], platform: "linux" }),
      update: async (request) => {
        if (request.step === "harnesses") state = { ...state, harnesses: request.harnesses };
        if (request.step === "complete") state = { ...state, completed: true, workAreas: request.workAreas };
        if (request.step === "skip") state = { ...state, completed: true };
        return state;
      },
    });
    workbench.registerModule(onboarding.module);
    void onboarding.open("project-1");
    return workbench;
  });
  return (
    <Box h="100dvh">
      <Workbench workbench={workbench} />
    </Box>
  );
};
const meta = {
  title: "Onboarding/Created project",
  component: CreatedProject,
  args: { previouslyCompleted: false },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CreatedProject>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Setup: Story = {};
export const PreviouslyCompleted: Story = { args: { previouslyCompleted: true } };
export const Finish: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("button", { name: "Continue" }));
    await userEvent.click(await body.findByRole("button", { name: /^Finish$/ }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(await body.findByText("Workspace", { selector: "p" })).toBeVisible();
  },
};
export const Skip: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("button", { name: "Skip setup" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(await body.findByText("Workspace", { selector: "p" })).toBeVisible();
  },
};
