import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { type ReactNode, useState } from "react";
import { Toaster, toaster } from "@/components/primitives/toaster";
import { WindowTitleBar } from "@/components/tab-strip/window-title-bar";

type StoryFn = () => ReactNode;
const longErrorOutput = `#1 [internal] load local bake definitions
#15 exporting to image
Image pstdio-ps-46-a2-prompt-studio Built
Container pstdio-ps-46-a2-prompt-studio-1 Creating
Error response from daemon: invalid volume specification:
'/host_mnt/Users/au-re/.pstdio-dev/workspaces/PS-46_A2/infra/local:.:rw'
invalid mount config for type "bind": invalid mount path: '.'
mount path must be absolute`;
const meta = {
  title: "Components/Feedback/Toaster",
  component: Toaster,
  decorators: [
    (Story: StoryFn) => (
      <Box minH="320px" padding="sm" background="bg">
        <Story />
      </Box>
    ),
  ],
};
export default meta;
export const Variants = {
  id: "components-feedback-toaster--variants",
  render: () => {
    const handleSuccess = () => {
      toaster.create({
        type: "success",
        title: "Pipeline saved",
        description: "The latest version is ready to run.",
      });
    };
    const handleWarning = () => {
      toaster.create({
        type: "warning",
        title: "Missing source files",
        description: "Add at least one file before starting the job.",
      });
    };
    const handleError = () => {
      toaster.create({
        type: "error",
        title: "Upload failed",
        description: "We could not reach the storage bucket.",
      });
    };
    const handleLoading = () => {
      toaster.create({
        type: "loading",
        title: "Preparing export",
        description: "Generating the bundle for this pipeline.",
      });
    };
    const handleLongError = () => {
      toaster.create({
        type: "error",
        title: "Run project failed",
        description: longErrorOutput,
      });
    };
    return (
      <Stack gap="md">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Trigger a toast to preview styling and placement.
        </Text>
        <HStack gap="sm" flexWrap="wrap">
          <Button size="sm" onClick={handleSuccess}>
            Success
          </Button>
          <Button size="sm" variant="outline" onClick={handleWarning}>
            Warning
          </Button>
          <Button size="sm" variant="destructive" onClick={handleError}>
            Error
          </Button>
          <Button size="sm" variant="ghost" onClick={handleLoading}>
            Loading
          </Button>
          <Button size="sm" variant="outline" onClick={handleLongError}>
            Long error
          </Button>
        </HStack>
        <Toaster />
      </Stack>
    );
  },
};
const DesktopTitleBarExample = () => {
  const [opened, setOpened] = useState(false);
  return (
    <Box data-window-full-screen="" position="fixed" inset="0">
      <WindowTitleBar platform="darwin" />
      <Stack padding="sm" gap="sm" alignItems="start">
        <Text textStyle="paragraph/S/regular">Toast controls stay below the desktop title bar.</Text>
        <Button
          size="sm"
          onClick={() =>
            toaster.create({
              type: "success",
              title: "Workspace ready",
              duration: Number.POSITIVE_INFINITY,
              action: { label: "Open workspace", onClick: () => setOpened(true) },
            })
          }
        >
          Show toast
        </Button>
        {opened && <Text>Workspace opened</Text>}
      </Stack>
      <Toaster />
    </Box>
  );
};
export const WithDesktopTitleBar = {
  id: "components-feedback-toaster--with-desktop-title-bar",
  tags: ["!manifest"],
  parameters: { layout: "fullscreen" },
  render: () => <DesktopTitleBarExample />,
};
