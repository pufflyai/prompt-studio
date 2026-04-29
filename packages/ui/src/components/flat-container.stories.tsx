import { Box, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { FlatContainer } from "./flat-container";

const meta = {
  title: "Components/FlatContainer",
  component: FlatContainer,
  decorators: [
    (Story: () => ReactNode) => (
      <Box padding="xl" background="bg">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof FlatContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <SimpleGrid columns={{ base: 1, md: 3 }} gap="xl" maxWidth="960px">
      <FlatContainer padding="md">
        <Stack gap="xs">
          <Text textStyle="label/L/medium">Bottom and right</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            The patterned offset replaces a conventional box shadow.
          </Text>
        </Stack>
      </FlatContainer>

      <FlatContainer variant="around" padding="md">
        <Stack gap="xs">
          <Text textStyle="label/L/medium">All around</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            The pattern frames every side of the container.
          </Text>
        </Stack>
      </FlatContainer>

      <FlatContainer variant="hover" padding="md">
        <Stack gap="xs">
          <Text textStyle="label/L/medium">Hover</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            The patterned shadow appears only while the container is hovered.
          </Text>
        </Stack>
      </FlatContainer>
    </SimpleGrid>
  ),
};

export const BorderColors: Story = {
  render: () => (
    <SimpleGrid columns={{ base: 1, md: 2 }} gap="xl" maxWidth="640px">
      <FlatContainer borderColor="border.muted" shadowColor="border.muted" padding="md">
        <Stack gap="xs">
          <Text textStyle="label/L/medium">border.muted</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Compare the visible patterned shadow color.
          </Text>
        </Stack>
      </FlatContainer>

      <FlatContainer borderColor="border.subtle" shadowColor="border.subtle" padding="md">
        <Stack gap="xs">
          <Text textStyle="label/L/medium">border.subtle</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Compare the lighter border token.
          </Text>
        </Stack>
      </FlatContainer>
    </SimpleGrid>
  ),
};

export const PatternDensity: Story = {
  render: () => (
    <SimpleGrid columns={{ base: 1, md: 3 }} gap="xl" maxWidth="960px">
      <FlatContainer shadowPatternDensity="loose" padding="md">
        <Stack gap="xs">
          <Text textStyle="label/L/medium">Loose</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            The wider repeat keeps the offset shadow subtle.
          </Text>
        </Stack>
      </FlatContainer>

      <FlatContainer padding="md">
        <Stack gap="xs">
          <Text textStyle="label/L/medium">Mid</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            The default repeat makes the diagonal pattern tighter.
          </Text>
        </Stack>
      </FlatContainer>

      <FlatContainer shadowPatternDensity="dense" padding="md">
        <Stack gap="xs">
          <Text textStyle="label/L/medium">Dense</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            The tightest repeat gives the pattern the most texture.
          </Text>
        </Stack>
      </FlatContainer>
    </SimpleGrid>
  ),
};

export const BorderExtension: Story = {
  render: () => (
    <SimpleGrid columns={{ base: 1, md: 2 }} gap="xl" maxWidth="640px">
      <FlatContainer borderExtension="extend-on-hover" padding="md">
        <Stack gap="xs">
          <Text textStyle="label/L/medium">Extend on hover</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            The corner overhang grows from the container edge.
          </Text>
        </Stack>
      </FlatContainer>

      <FlatContainer borderExtension="retract-on-hover" padding="md">
        <Stack gap="xs">
          <Text textStyle="label/L/medium">Retract on hover</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            The corner overhang pulls back to the container edge.
          </Text>
        </Stack>
      </FlatContainer>
    </SimpleGrid>
  ),
};
