import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { START_HERE_INTRO, START_HERE_TITLE } from "../src/components/downloads/download-panel";
import { siteMetadata } from "../src/config/site-metadata";
import { BrandCanvas } from "./brand-canvas";
import { IconMark } from "./icon-mark";
import { WorkbenchMock } from "./workbench-mock";

export const BANNER_WIDTH = 1200;
export const BANNER_HEIGHT = 630;

const HARNESSES = ["claude code", "codex", "opencode"];

const HarnessTag = (props: { label: string }) => {
  const { label } = props;
  return (
    <Box px="12px" py="6px" borderWidth="1px" borderStyle="dashed" borderColor="fg.subtle" color="fg.muted">
      <Text fontFamily="mono" fontSize="12px" letterSpacing="1.2px">
        {label}
      </Text>
    </Box>
  );
};

export const Banner = () => (
  <BrandCanvas>
    <Box position="absolute" top="120px" right="72px" width="504px" height="390px">
      <WorkbenchMock />
    </Box>
    <Flex
      position="absolute"
      top="72px"
      bottom="72px"
      left="72px"
      width="492px"
      direction="column"
      justify="space-between"
    >
      <HStack gap="14px">
        <IconMark size={44} radius={13} />
        <Text textStyle="brand">Prompt Studio</Text>
        <Box px="10px" py="4px" borderRadius="full" bg="illustration.skill" color="white">
          <Text textStyle="label/2XS/medium" textTransform="uppercase" letterSpacing="0.9px">
            Alpha
          </Text>
        </Box>
      </HStack>
      <Stack gap="20px">
        <Text textStyle="heading/XL">{START_HERE_TITLE}</Text>
        <Text fontFamily="body" fontSize="20px" lineHeight="150%" color="fg.muted">
          {START_HERE_INTRO}
        </Text>
      </Stack>
      <Stack gap="24px">
        <HStack gap="8px">
          {HARNESSES.map((harness) => (
            <HarnessTag key={harness} label={harness} />
          ))}
        </HStack>
        <Text fontFamily="mono" fontSize="14px" letterSpacing="1.2px" color="fg.muted">
          {siteMetadata.siteUrl.replace("https://", "")}
        </Text>
      </Stack>
    </Flex>
  </BrandCanvas>
);
