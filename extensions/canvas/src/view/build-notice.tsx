import { Box, Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";

export type BuildStatus = "loading" | "missing" | "empty" | "unsupported" | "failed" | "removed" | "error";

const EXAMPLE = `// src/button.canvas.tsx
import { Button } from "./button";

export default { title: "Components/Button", component: Button };
export const Primary = { args: { children: "Save" } };`;

const COMMANDS = `bun add -d @pstdio/canvas
bun x pstdio-canvas watch`;

const Code = (props: { children: string }) => (
  <Box
    as="pre"
    textStyle="mono/XS"
    p="sm"
    borderWidth="1px"
    borderColor="border.subtle"
    borderRadius="xs"
    overflowX="auto"
  >
    {props.children}
  </Box>
);

interface BuildNoticeProps {
  status: BuildStatus;
  message?: string;
  name?: string;
}

// UI Canvas only shows what `pstdio-canvas` built, so every state tells the person what to run.
export const BuildNotice = (props: BuildNoticeProps) => {
  const { status, message, name } = props;
  if (status === "loading")
    return (
      <Text p="sm" textStyle="paragraph/S/regular" data-ui-canvas-loading>
        Loading canvas…
      </Text>
    );
  if (status === "failed" || status === "error")
    return (
      <Stack p="md" gap="sm" maxW="3xl" data-ui-canvas-build-error>
        <Text textStyle="heading/S">{name ? `${name} could not be built` : "The canvas build could not be read"}</Text>
        <Text textStyle="paragraph/S/regular">
          The other canvases still work. The watcher rebuilds this one when a file changes.
        </Text>
        {message && <Code>{message}</Code>}
      </Stack>
    );
  if (status === "removed") return <EmptyState title="This canvas no longer exists" />;
  if (status === "unsupported")
    return (
      <EmptyState
        title="Update @pstdio/canvas or UI Canvas"
        description="This build was written by a version of @pstdio/canvas that this UI Canvas cannot read."
      />
    );
  return (
    <Stack p="md" gap="sm" maxW="3xl" data-ui-canvas-setup>
      <Text textStyle="heading/S">
        {status === "empty" ? "No canvas files in this project" : "Start the canvas watcher"}
      </Text>
      <Text textStyle="paragraph/S/regular">
        UI Canvas shows what @pstdio/canvas builds from this project's .canvas.tsx files. Install it and keep the
        watcher running, or ask an agent to.
      </Text>
      <Code>{COMMANDS}</Code>
      <Text textStyle="paragraph/S/regular">
        Then add a canvas file next to a component. Each named export is one frame.
      </Text>
      <Code>{EXAMPLE}</Code>
    </Stack>
  );
};
