import { Box, Stack, Text } from "@chakra-ui/react";
import type { SceneProps } from "motion-lab/kit";
import {
  duration,
  FileRow,
  FolderInput,
  files,
  PanelSurface,
  PanelTab,
  progress,
  timings,
  track,
  WorkbenchFrame,
} from "motion-lab/kit";

export const Rows = (props: SceneProps) => {
  const { time } = props;
  const input = track(time, [
    { at: 1, value: 48, duration: duration(props, timings.rowSpace, true) },
    { at: 3, value: 0, duration: duration(props, timings.rowRemove, true) },
    { at: 4.5, value: 48, duration: duration(props, timings.rowSpace, true) },
    { at: 5.5, value: 0, duration: duration(props, timings.rowRemove, true) },
  ]);
  const row = progress(time, 3, duration(props, timings.rowSpace, true));
  const rowFade = progress(time, 3 + duration(props, timings.rowSpace, true), duration(props, timings.rowFade));
  return (
    <WorkbenchFrame>
      <PanelSurface header={<PanelTab title="Files" />}>
        <Stack p="lg" gap="md" maxW="3xl" w="full" mx="auto">
          <Text textStyle="heading/M">Project files</Text>
          <Text textStyle="label/S/regular" color="fg.muted">
            /Users/alex/Documents/Project
          </Text>
          <Box h={`${input}px`} overflow="hidden">
            <FolderInput value={time >= 2 && time < 3 ? "assets" : ""} />
          </Box>
          <Stack gap="0">
            <FileRow name="src" folder />
            <Box h={`${row * 28}px`} overflow="hidden" opacity={rowFade}>
              <FileRow name="assets" folder />
            </Box>
            {files.map((name) => (
              <FileRow key={name} name={name} />
            ))}
          </Stack>
        </Stack>
      </PanelSurface>
    </WorkbenchFrame>
  );
};

export default Rows;
