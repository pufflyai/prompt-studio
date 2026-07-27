import { Box, Button, Container, HStack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ParamEditor } from "./param-editor";

const meta = {
  title: "Components/Inputs/Param Editor/Inspector",
  component: ParamEditor,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ParamEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GroupedInspector: Story = {
  render: (props) => {
    return (
      <Container padding="md">
        <Box
          maxWidth="360px"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="xs"
          bg="bg.subtle"
          overflow="hidden"
        >
          <ParamEditor {...props} />
        </Box>
      </Container>
    );
  },
  args: {
    fullWidth: true,
    defaultValues: {
      model: "balanced",
      temperature: 0.4,
      prompt: "Summarize the selected workspace changes.",
      accent: "#0c8ce9",
      publishDate: "2026-07-01",
      visibility: "draft",
    },
    onChange: () => {},
    groups: [
      {
        id: "generation",
        title: "Generation",
        description: "Core prompt and model behavior.",
        collapsible: true,
        params: [
          {
            id: "model",
            name: "Model",
            type: "selection",
            description: "Generation profile",
            defaultValue: "balanced",
            options: [
              { id: "fast", name: "Fast" },
              { id: "balanced", name: "Balanced" },
              { id: "deep", name: "Deep" },
            ],
          },
          {
            id: "temperature",
            name: "Temperature",
            type: "number",
            description: "Sampling variance",
            defaultValue: 0.4,
            min: 0,
            max: 1,
            step: 0.1,
          },
          {
            id: "prompt",
            name: "Prompt",
            type: "text",
            description: "Instruction template",
            defaultValue: "Summarize the selected workspace changes.",
            singleLine: false,
          },
        ],
      },
      {
        id: "appearance",
        title: "Appearance",
        description: "Presentation metadata for generated output.",
        collapsible: true,
        params: [
          {
            id: "accent",
            name: "Accent",
            type: "color",
            description: "Primary output color",
            defaultValue: "#0c8ce9",
          },
          {
            id: "visibility",
            name: "Visibility",
            type: "property",
            description: "Current publication state",
            value: (
              <HStack gap="xs">
                <Text textStyle="label/S/regular">Draft</Text>
                <Button size="xs" variant="ghost">
                  Change
                </Button>
              </HStack>
            ),
          },
        ],
      },
      {
        id: "schedule",
        title: "Schedule",
        description: "Optional delivery settings.",
        collapsible: true,
        defaultCollapsed: true,
        params: [
          {
            id: "publishDate",
            name: "Publish Date",
            type: "date",
            description: "Target publish date",
            defaultValue: "2026-07-01",
          },
        ],
      },
    ],
  },
};

export const SmallInspector: Story = {
  ...GroupedInspector,
  args: { ...GroupedInspector.args, variant: "small" },
};

export const SerializableReadOnlyValues: Story = {
  render: (props) => (
    <Container padding="md">
      <Box maxWidth="380px" borderWidth="1px" borderColor="border.subtle" borderRadius="xs" overflow="hidden">
        <ParamEditor {...props} />
      </Box>
    </Container>
  ),
  args: {
    readOnly: true,
    fullWidth: true,
    params: [
      { id: "name", name: "Name", type: "readOnly", value: "Mina Patel" },
      { id: "verified", name: "Verified", type: "readOnly", value: true },
      { id: "phone", name: "Phone", type: "readOnly", value: null },
      { id: "interests", name: "Interests", type: "readOnly", value: ["Design", "Travel", "Sustainability"] },
      {
        id: "gallery",
        name: "Gallery",
        type: "readOnly",
        value: {
          type: "image-gallery",
          images: [
            { src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=240", alt: "Mountain lake" },
            { src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=240", alt: "Forest" },
          ],
        },
      },
    ],
  },
};
