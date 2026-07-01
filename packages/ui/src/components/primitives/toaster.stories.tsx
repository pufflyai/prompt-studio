import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { Toaster, toaster } from "@/components/primitives/toaster";

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
