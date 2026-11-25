import { Heading, Stack, Text } from "@chakra-ui/react";

export const HomeWelcome = () => (
  <Stack gap="sm" minW="0">
    <Heading as="h1" textStyle="heading/dialog">
      Welcome to Prompt Studio
    </Heading>
    <Text textStyle="paragraph/M/regular" color="fg.muted">
      Coding agents can build tools for your project. This workbench gives those tools a place to live and work
      together.
    </Text>
  </Stack>
);
