import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { HomeScene, ShapesScene, TogetherScene, WhyScene, YoursScene } from "./iso-scenes";

const meta = {
  title: "Website/Landing/Isometric scenes",
  component: HomeScene,
  decorators: [
    (Story) => (
      <Box width="44rem" maxWidth="full">
        <Story />
      </Box>
    ),
  ],
} satisfies CanvasMeta<typeof HomeScene>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Home: Story = {
  id: "landing-iso-scenes--home",
  description:
    "Agents code a tool, carry the block onto the workbench, and pat it into shape. When the four slots are full one clicks + for a new tab. Pick up a finished tool and an agent chases it back.",
};
export const Why: Story = {
  id: "landing-iso-scenes--why",
  description:
    "Agent-built files pile up and age in fast-forward until the workbench rises and they become named tools.",
  render: () => <WhyScene />,
};
export const AnyShape: Story = {
  id: "landing-iso-scenes--any-shape",
  description: "Dropping a token reshapes the workbench; the active token sits in the socket on the plate.",
  render: () => <ShapesScene />,
};
export const Together: Story = {
  id: "landing-iso-scenes--together",
  description: "A live chart is copied into notes and scheduled; both charts move with the same data.",
  render: () => <TogetherScene />,
};
export const Yours: Story = {
  id: "landing-iso-scenes--yours",
  description: "An agent keeps trying to carry the workbench off the laptop and it springs back.",
  render: () => <YoursScene />,
};
