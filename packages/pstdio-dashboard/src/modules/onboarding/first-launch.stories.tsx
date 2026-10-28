import { Box } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { OnboardingState } from "pstdio-api-contracts";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { createBootstrapModule } from "../bootstrap";
import { createProjectsModule } from "../projects/module";
import { createOnboardingModule } from "./module";

const FirstLaunch = () => {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { enabled: false } } }));
  const [workbench] = useState(() => {
    const workbench = createWorkbench();
    let state: OnboardingState = { completed: false, hidden: false, harnesses: null, workAreas: null };
    const onboarding = createOnboardingModule({
      read: async () => ({ state, detectedHarnesses: [], platform: "linux" }),
      update: async (request) => {
        if (request.step === "harnesses") state = { ...state, harnesses: request.harnesses };
        if (request.step === "complete") state = { ...state, completed: true, workAreas: request.workAreas };
        if (request.step === "skip") state = { ...state, completed: true };
        return state;
      },
    });
    workbench.registerModule(createProjectsModule());
    workbench.registerModule(onboarding.module);
    workbench.registerModule(createBootstrapModule({ beforeOpen: onboarding.open, isInitialSyncComplete: () => true }));
    return workbench;
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Box h="100dvh">
        <Workbench workbench={workbench} />
      </Box>
    </QueryClientProvider>
  );
};

const meta = {
  title: "Onboarding/First launch",
  component: FirstLaunch,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FirstLaunch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoProjects: Story = {};
export const Finish: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("button", { name: "Continue" }));
    await userEvent.click(await body.findByRole("button", { name: /^Finish$/ }));
    await expect(await body.findByText("No projects yet")).toBeVisible();
    await expect(body.getByRole("button", { name: "Create project" })).toBeVisible();
  },
};
export const Skip: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("button", { name: "Skip setup" }));
    await expect(await body.findByText("No projects yet")).toBeVisible();
  },
};
