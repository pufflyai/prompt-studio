import { Box, Flex, Grid, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";

export const FoundationColors = () => (
  <ScrollArea h="full">
    <Stack p="md" gap="lg">
      <Text textStyle="heading/M">Colors</Text>
      <Grid templateColumns="repeat(3, minmax(0, 1fr))" gap="md">
        {[
          "bg",
          "bg.subtle",
          "bg.muted",
          "bg.hover",
          "bg.active",
          "fg",
          "fg.muted",
          "fg.subtle",
          "fg.info",
          "fg.success",
          "fg.warning",
          "fg.error",
          "border",
          "border.subtle",
          "bg.button.primary.default",
          "fg.button.primary.default",
        ].map((token) => (
          <Stack key={token} gap="xs">
            <Box bg={token} minH="touch-target" borderWidth="1px" borderColor="border.subtle" borderRadius="xs" />
            <Text textStyle="mono/XS">{token}</Text>
          </Stack>
        ))}
      </Grid>
    </Stack>
  </ScrollArea>
);

const typeStyles = [
  "heading/display/L",
  "heading/XL",
  "heading/L",
  "heading/M",
  "heading/S",
  "label/L/medium",
  "label/M/medium",
  "label/S/medium",
  "label/XS/medium",
  "label/XS/caps",
  "paragraph/M/regular",
  "paragraph/S/regular",
  "mono/XS",
] as const;
export const FoundationTypography = () => (
  <ScrollArea h="full">
    <Stack p="md" gap="lg">
      <Text textStyle="heading/M">Typography</Text>
      {typeStyles.map((style) => (
        <Stack key={style} gap="xs">
          <Text textStyle="mono/XS" color="fg.muted">
            {style}
          </Text>
          <Text textStyle={style}>{style.startsWith("mono") ? "bun run build" : "Compose, test and ship prompts"}</Text>
        </Stack>
      ))}
    </Stack>
  </ScrollArea>
);

const spacing = [
  "3xs",
  "2xs",
  "xs",
  "compact",
  "sm",
  "comfortable",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "3.5xl",
  "4xl",
  "4.5xl",
  "5xl",
] as const;
const radii = ["none", "2xs", "xs", "compact", "sm", "md", "lg", "xl", "full"] as const;
export const FoundationSpacing = () => (
  <ScrollArea h="full">
    <Stack p="md" gap="lg">
      <Text textStyle="heading/M">Spacing &amp; radius</Text>
      <Stack gap="xs">
        {spacing.map((token) => (
          <Flex key={token} align="center" gap="md">
            <Text flex="1" textStyle="mono/XS">
              {token}
            </Text>
            <Box paddingStart={token} py="2xs" bg="fg.muted" />
          </Flex>
        ))}
      </Stack>
      <Grid templateColumns="repeat(3, minmax(0, 1fr))" gap="md">
        {radii.map((token) => (
          <Stack key={token} gap="xs">
            <Box p="lg" bg="bg.muted" borderWidth="1px" borderColor="border" borderRadius={token} />
            <Text textStyle="mono/XS">{token}</Text>
          </Stack>
        ))}
      </Grid>
    </Stack>
  </ScrollArea>
);
