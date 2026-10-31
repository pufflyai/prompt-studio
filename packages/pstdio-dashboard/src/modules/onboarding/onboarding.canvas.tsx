import { Box, Dialog, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { OnboardingInfo } from "pstdio-api-contracts";
import { useState } from "react";
import { Onboarding } from "./onboarding";

const info: OnboardingInfo = {
  platform: "darwin",
  detectedHarnesses: ["codex", "open-code"],
  installedExtensions: ["pstdio.pstdio-base-themes", "pstdio.pstdio-skills"],
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
          <Dialog.Content w="4xl" h="xl" maxW="calc(100vw - {spacing.xl})" maxH="calc(100dvh - {spacing.xl})">
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
  fullscreen: true,
} satisfies CanvasMeta<typeof Example>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Harnesses: Story = { id: "onboarding-setup--harnesses" };
export const NoHarness: Story = {
  id: "onboarding-setup--no-harness",
  args: { info: { ...info, state: { ...info.state, harnesses: [] } } },
};
export const InstalledHarness: Story = {
  id: "onboarding-setup--installed-harness",
  args: {
    info: {
      ...info,
      detectedHarnesses: [],
      installedExtensions: [...info.installedExtensions, "pstdio.harness-claude-code"],
    },
  },
};
export const InstalledWork: Story = {
  id: "onboarding-setup--installed-work",
  args: {
    info: {
      ...info,
      installedExtensions: [
        ...info.installedExtensions,
        "pstdio.pstdio-planner",
        "pstdio.pstdio-reports",
        "pstdio.pstdio-artifacts",
      ],
    },
  },
};
