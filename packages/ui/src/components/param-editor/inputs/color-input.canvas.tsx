import { Box, Container } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ColorInput } from "./color-input";

const meta = {
  title: "Components/Inputs/Param Editor/Color Input",
  component: ColorInput,
  fullscreen: true,
} satisfies CanvasMeta<typeof ColorInput>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const ClosesOnBlur: Story = {
  id: "components-inputs-param-editor-color-input--closes-on-blur",
  render: (props) => {
    return (
      <Container padding="md">
        <ColorInput {...props} />
        <Box as="button" mt="md">
          Next field
        </Box>
      </Container>
    );
  },
  args: {
    id: "theme-color",
    defaultValue: "#ff0000",
    name: "Theme Color",
    description: "Pick a theme color",
    onChange: () => {},
  },
};
