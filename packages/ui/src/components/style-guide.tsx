import { Badge, Box, Button, HStack, Input, Separator, SimpleGrid, Stack, Text, Textarea } from "@chakra-ui/react";

import {
  type ColorSwatch,
  colorGroups,
  fontSamples,
  radiusSamples,
  shadowSamples,
  spacingSamples,
  typographySamples,
} from "./style-guide-data";

interface SectionHeaderProps {
  title: string;
  description: string;
  kicker?: string;
}

const swatchVariants = {
  fill: (swatch: ColorSwatch) => ({
    background: swatch.token,
    color: swatch.textToken ?? "fg",
    borderColor: "transparent",
    borderWidth: "0px",
  }),
  stroke: (swatch: ColorSwatch) => ({
    background: "bg",
    color: swatch.textToken ?? "fg",
    borderColor: swatch.token,
    borderWidth: "2px",
  }),
};

const getScaledSpacing = (value: string) => `calc(${value} * 6)`;

const SectionHeader = (props: SectionHeaderProps) => {
  const { title, description, kicker } = props;

  return (
    <Stack gap="xs">
      {kicker ? (
        <Text textStyle="label/L/medium/uppercase" color="fg.muted">
          {kicker}
        </Text>
      ) : null}
      <Text textStyle="heading/M">{title}</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        {description}
      </Text>
    </Stack>
  );
};

export const StyleGuide = () => (
  <Stack gap="2xl" padding="xl" color="fg">
    <Box>
      <Stack gap="2xs">
        <Text textStyle="brand">PSTDIO design system</Text>
        <Text textStyle="paragraph/L/regular" color="fg.muted">
          A shared language for product, engineering, and operations teams shipping automation at scale.
        </Text>
      </Stack>
    </Box>

    <Separator />

    <Stack gap="lg">
      <SectionHeader
        kicker="Typography"
        title="Fonts and text styles"
        description="Type scales keep dashboards readable while supporting editorial moments in marketing."
      />

      <SimpleGrid columns={{ base: 1, md: 3 }} gap="md">
        {fontSamples.map((font) => (
          <Box
            key={font.label}
            borderWidth="1px"
            borderColor="border.muted"
            borderRadius="md"
            padding="md"
            background="bg"
          >
            <Stack gap="xs">
              <Text textStyle="label/L/medium">{font.label}</Text>
              <Text textStyle="label/XS" color="fg.muted">
                {font.role}
              </Text>
              <Text fontFamily={font.fontFamily} fontSize="xl">
                {font.sample}
              </Text>
            </Stack>
          </Box>
        ))}
      </SimpleGrid>

      <Stack gap="sm">
        {typographySamples.map((sample) => (
          <Stack
            key={sample.label}
            gap="md"
            paddingY="sm"
            borderBottomWidth="1px"
            borderColor="border.muted"
            direction={{ base: "column", lg: "row" }}
            justifyContent="space-between"
            alignItems={{ base: "flex-start", lg: "center" }}
          >
            <Stack gap="xs" maxWidth={{ base: "100%", lg: "45%" }}>
              <Text textStyle="label/L/medium">{sample.label}</Text>
              <Text textStyle="label/XS" color="fg.muted">
                {sample.description}
              </Text>
            </Stack>
            <Text textStyle={sample.textStyle}>{sample.sample}</Text>
          </Stack>
        ))}
      </Stack>
    </Stack>

    <Stack gap="lg">
      <SectionHeader
        kicker="Color"
        title="Semantic palette"
        description="Surface, accent, and border tokens keep light and dark themes aligned."
      />

      <Stack gap="lg">
        {colorGroups.map((group) => (
          <Stack key={group.title} gap="sm">
            <Stack gap="xs">
              <Text textStyle="label/L/medium">{group.title}</Text>
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                {group.description}
              </Text>
            </Stack>

            <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="sm">
              {group.swatches.map((swatch) => {
                const variantKey = swatch.variant ?? "fill";
                const style = swatchVariants[variantKey](swatch);

                return (
                  <Box key={swatch.token} borderWidth="1px" borderColor="border.muted" borderRadius="md">
                    <Box
                      minHeight="96px"
                      padding="md"
                      background={style.background}
                      color={style.color}
                      borderWidth={style.borderWidth}
                      borderColor={style.borderColor}
                      borderTopRadius="md"
                    >
                      <Stack gap="xs">
                        <Text textStyle="label/M/medium">{swatch.label}</Text>
                        <Text textStyle="label/XS">{swatch.token}</Text>
                      </Stack>
                    </Box>
                    <Box padding="sm">
                      <Text textStyle="label/XS" color="fg.muted">
                        {swatch.description}
                      </Text>
                    </Box>
                  </Box>
                );
              })}
            </SimpleGrid>
          </Stack>
        ))}
      </Stack>
    </Stack>

    <Stack gap="lg">
      <SectionHeader
        kicker="Layout"
        title="Spacing, radius, and elevation"
        description="Consistent rhythm and depth cues create polish across dashboards."
      />

      <SimpleGrid columns={{ base: 1, lg: 3 }} gap="md">
        <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" padding="md">
          <Stack gap="sm">
            <Text textStyle="label/L/medium">Spacing scale</Text>
            {spacingSamples.map((sample) => (
              <Stack key={sample.token} gap="xs">
                <HStack justifyContent="space-between">
                  <Text textStyle="label/S/medium">{sample.label}</Text>
                  <Text textStyle="label/XS" color="fg.muted">
                    {sample.value}
                  </Text>
                </HStack>
                <Box height="8px" background="bg.muted">
                  <Box height="8px" background="fg" width={getScaledSpacing(sample.value)} maxWidth="240px" />
                </Box>
                <Text textStyle="label/XS" color="fg.muted">
                  {sample.helper}
                </Text>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" padding="md">
          <Stack gap="sm">
            <Text textStyle="label/L/medium">Radius scale</Text>
            <SimpleGrid columns={{ base: 2, md: 3 }} gap="sm">
              {radiusSamples.map((sample) => (
                <Stack key={sample.token} gap="xs">
                  <Box
                    height="56px"
                    borderWidth="1px"
                    borderColor="border.muted"
                    borderRadius={sample.token}
                    background="bg"
                  />
                  <Text textStyle="label/S/medium">{sample.label}</Text>
                  <Text textStyle="label/XS" color="fg.muted">
                    {sample.helper}
                  </Text>
                </Stack>
              ))}
            </SimpleGrid>
          </Stack>
        </Box>

        <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" padding="md">
          <Stack gap="sm">
            <Text textStyle="label/L/medium">Elevation</Text>
            {shadowSamples.map((sample) => (
              <Stack key={sample.token} gap="xs">
                <Box
                  height="56px"
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor="border.muted"
                  background="bg"
                  boxShadow={sample.token}
                />
                <Text textStyle="label/S/medium">{sample.label}</Text>
                <Text textStyle="label/XS" color="fg.muted">
                  {sample.helper}
                </Text>
              </Stack>
            ))}
          </Stack>
        </Box>
      </SimpleGrid>
    </Stack>

    <Stack gap="lg">
      <SectionHeader
        kicker="Components"
        title="Core UI building blocks"
        description="Buttons, badges, and inputs are ready for use across flows."
      />

      <SimpleGrid columns={{ base: 1, lg: 3 }} gap="md">
        <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" padding="md">
          <Stack gap="sm">
            <Text textStyle="label/L/medium">Buttons</Text>
            <HStack gap="sm" flexWrap="wrap">
              <Button variant="primary">Primary</Button>
              <Button variant="solid">Solid</Button>
              <Button variant="surface">Surface</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="solid" colorPalette="red">
                Solid red
              </Button>
            </HStack>
          </Stack>
        </Box>

        <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" padding="md">
          <Stack gap="sm">
            <Text textStyle="label/L/medium">Badges</Text>
            <HStack gap="sm" flexWrap="wrap">
              <Badge colorPalette="green" variant="subtle">
                Success
              </Badge>
              <Badge colorPalette="yellow" variant="subtle">
                Pending
              </Badge>
              <Badge colorPalette="red" variant="subtle">
                Attention
              </Badge>
              <Badge colorPalette="blue" variant="subtle">
                Info
              </Badge>
            </HStack>
          </Stack>
        </Box>

        <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" padding="md">
          <Stack gap="sm">
            <Text textStyle="label/L/medium">Inputs</Text>
            <Stack gap="sm">
              <Input placeholder="Company name" />
              <Textarea placeholder="Notes" minHeight="96px" />
            </Stack>
          </Stack>
        </Box>
      </SimpleGrid>
    </Stack>
  </Stack>
);
