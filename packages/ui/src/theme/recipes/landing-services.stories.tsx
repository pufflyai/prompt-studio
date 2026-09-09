import { Badge, Box, HStack, Input, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Bot, FileCode, Shapes, Star } from "lucide-react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { ListRow } from "@/components/list-row/list-row";
import { Switch } from "@/components/primitives/switch";

const SharedFeatures = () => {
  const story = useSlotRecipe({ key: "landingStory" })({});
  const tools = useSlotRecipe({ key: "landingToolDemo" })({});
  const extensions = [
    { id: "icons", name: "Icon set editor", icon: Shapes },
    { id: "shader", name: "Shader editor", icon: FileCode },
    { id: "agents", name: "Coding agent dashboard", icon: Bot },
  ];
  const [enabled, setEnabled] = useState(extensions.map((extension) => extension.id));
  return (
    <Box css={story.page}>
      <Stack gap="sm">
        <Text as="h1" textStyle="heading/M">
          A solid foundation to extend from
        </Text>
        <Text color="fg.muted">Shared features that every tool can use.</Text>
      </Stack>
      <Box css={story.featureSection}>
        <Text as="h2" textStyle="heading/S">
          Search
        </Text>
        <Box css={story.visual}>
          <Box css={story.panel}>
            <Box css={story.panelHeader}>
              <Input aria-label="Search tools" placeholder="Search tools, files, and commands…" variant="borderless" />
            </Box>
            <Box css={story.panelBody}>
              <ListRow
                label="Icon set editor"
                icon={<Shapes size={16} />}
                isSelected
                endContent={<Badge>Tool</Badge>}
              />
              <ListRow label="Coding agent dashboard" icon={<Bot size={16} />} endContent={<Badge>Tool</Badge>} />
            </Box>
          </Box>
        </Box>
      </Box>
      <Box css={story.featureSection}>
        <Text as="h2" textStyle="heading/S">
          Extension management
        </Text>
        <Box css={story.visual}>
          <Box css={story.panel}>
            <Box css={story.panelHeader}>Installed extensions</Box>
            <Box css={story.panelBody}>
              {extensions.map((extension) => (
                <HStack key={extension.id} gap="md">
                  <extension.icon size={24} />
                  <Text flex="1" textStyle="label/M/medium">
                    {extension.name}
                  </Text>
                  <Switch
                    aria-label={`Enable ${extension.name}`}
                    checked={enabled.includes(extension.id)}
                    onCheckedChange={({ checked }) =>
                      setEnabled((current) =>
                        checked ? [...current, extension.id] : current.filter((id) => id !== extension.id),
                      )
                    }
                  />
                </HStack>
              ))}
            </Box>
          </Box>
          <Stack gap="sm" mt="md">
            <Text textStyle="label/S/medium">Your workbench · {enabled.length} panels</Text>
            <Box css={tools.extensionPanels}>
              {extensions
                .filter((extension) => enabled.includes(extension.id))
                .map((extension) => (
                  <Box key={extension.id} css={story.panel} role="region" aria-label={`${extension.name} panel`}>
                    <HStack css={story.panelHeader}>
                      <extension.icon size={16} />
                      <Text>{extension.name}</Text>
                    </HStack>
                    <Box css={story.panelBody}>
                      {extension.id === "icons" && (
                        <HStack gap="md">
                          <Star />
                          <Shapes />
                          <FileCode />
                        </HStack>
                      )}
                      {extension.id === "shader" && (
                        <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap="md" color="fg.success">
                          {Array.from({ length: 16 }, (_, index) => (
                            <Star key={index} size={16} />
                          ))}
                        </Box>
                      )}
                      {extension.id === "agents" && (
                        <Stack gap="sm">
                          <Text textStyle="label/S/medium">Codex · Done</Text>
                          <Text textStyle="paragraph/S/regular">Connect the icon set to the shader.</Text>
                        </Stack>
                      )}
                    </Box>
                  </Box>
                ))}
              {enabled.length === 0 && <Text color="fg.muted">Enable an extension to add its panel.</Text>}
            </Box>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

const meta = {
  title: "Theme/Landing Services",
  component: SharedFeatures,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SharedFeatures>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = {};
export const TogglePanels: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("checkbox", { name: "Enable Icon set editor" });
    await userEvent.click(toggle);
    await expect(canvas.queryByRole("region", { name: "Icon set editor panel" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("region", { name: "Shader editor panel" })).toBeVisible();
    await userEvent.click(toggle);
    await expect(canvas.getByRole("region", { name: "Icon set editor panel" })).toBeVisible();
  },
};
export const NarrowPanel: Story = {
  decorators: [
    (Story) => (
      <Box width="80">
        <Story />
      </Box>
    ),
  ],
};
