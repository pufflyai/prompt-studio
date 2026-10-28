import { Box, Container } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor } from "storybook/test";
import { ColorInput } from "./color-input";

const meta = {
  title: "Components/Inputs/Param Editor/Color Input",
  component: ColorInput,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ColorInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ClosesOnBlur: Story = {
  tags: ["param-editor-color-input"],
  render: (props) => {
    return (
      <Container padding="md">
        <ColorInput {...props} />
        <Box as="button" type="button" mt="md">
          Next field
        </Box>
      </Container>
    );
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLButtonElement>("[data-scope='color-picker'][data-part='trigger']");
    const input = canvasElement.querySelector<HTMLInputElement>(
      "[data-scope='color-picker'][data-part='channel-input']",
    );
    const content = canvasElement.ownerDocument.querySelector("[data-scope='color-picker'][data-part='content']");

    if (!trigger || !input || !content) throw new Error("Color picker story controls were not rendered.");

    await userEvent.click(trigger);
    await waitFor(() => expect(content).toBeVisible());

    await userEvent.click(input);

    await waitFor(() => expect(content).not.toBeVisible());
  },
  args: {
    id: "theme-color",
    defaultValue: "#ff0000",
    name: "Theme Color",
    description: "Pick a theme color",
    onChange: () => {},
  },
};
