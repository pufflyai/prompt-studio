import { Box, Link, Stack, Text } from "@chakra-ui/react";
import { WorkbenchIcon } from "@pstdio/workbench/react";

export const promptStudioUrl = "https://prompt.studio";

export const StartAboutPanel = () => (
  <Box borderWidth="1px" borderColor="border" bg="bg.subtle" rounded="sm" p="lg" minW="0">
    <Stack gap="sm" minW="0">
      <Text textStyle="label/M/regular">A workbench for your tools.</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        Coding agents can build tools to help with your work. Prompt Studio gives them a place to live, with the shared
        infrastructure they need to work together.
      </Text>
      <Link
        href={promptStudioUrl}
        target="_blank"
        rel="noreferrer"
        color="fg.info"
        textStyle="label/S/regular"
        gap="xs"
        alignSelf="flex-start"
      >
        <WorkbenchIcon name="external-link" size={14} />
        prompt.studio
      </Link>
    </Stack>
  </Box>
);
