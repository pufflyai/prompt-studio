import { Box, Dialog, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { OnboardingInfo } from "pstdio-api-contracts";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Onboarding } from "./onboarding";

const info: OnboardingInfo = {
  platform: "darwin",
  detectedHarnesses: ["codex", "open-code"],
  state: { completed: false, hidden: false, harnesses: null, workAreas: null },
};
const Example = (props: { info: OnboardingInfo }) => {
  const [complete, setComplete] = useState(false);
  if (complete) return <Text>Workspace</Text>;
  return (
    <Box h="100dvh">
      <Dialog.Root open placement="center" scrollBehavior="inside" closeOnInteractOutside={false}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content w="4xl" h="3xl" maxW="calc(100vw - {spacing.xl})" maxH="calc(100dvh - {spacing.xl})">
            <Onboarding
              info={props.info}
              update={async (request) => ({
                ...props.info.state,
                ...(request.step === "harnesses" ? { harnesses: request.harnesses } : {}),
                ...(request.step === "complete" ? { completed: true, workAreas: request.workAreas } : {}),
                ...(request.step === "skip" ? { completed: true } : {}),
              })}
              onComplete={() => setComplete(true)}
            />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  );
};
const meta = {
  title: "Onboarding/Setup",
  component: Example,
  args: { info },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Harnesses: Story = {};
export const NoHarness: Story = { args: { info: { ...info, state: { ...info.state, harnesses: [] } } } };
export const Work: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Continue" }));
    await expect(within(canvasElement).getByRole("heading", { name: "What do you want to work on?" })).toBeVisible();
  },
};
export const BackNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Continue" }));
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expect(canvas.getByRole("heading", { name: "Choose your harnesses" })).toBeVisible();
    await expect(canvas.getByRole("checkbox", { name: "Codex" })).toBeChecked();
    await expect(canvas.getByRole("checkbox", { name: "OpenCode" })).toBeChecked();
  },
};
export const CombinedWork: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Continue" }));
    await userEvent.click(await canvas.findByText("Project planning", { selector: "span, p" }));
    const list = within(canvas.getByRole("region", { name: "Extensions to install" }));
    await expect(list.getAllByText("Project Planner")).toHaveLength(1);
    await expect(list.getByText("Notes")).toBeVisible();
  },
};
export const Skip: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Skip setup" }));
    await expect(await canvas.findByText("Workspace")).toBeVisible();
  },
};
