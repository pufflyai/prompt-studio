import { Box, chakra, useSlotRecipe } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { landingAssemblySlotRecipe } from "../../theme/recipes/landing-assembly";
import { AssemblyCursor } from "./assembly-cursor";

const CursorModes = () => {
  const styles = useSlotRecipe({ recipe: landingAssemblySlotRecipe })({});
  return (
    <Box width="96" height="24">
      <chakra.svg css={styles.scene} data-assembly-ready="true" viewBox="0 0 384 96">
        <AssemblyCursor name="Claude" index={0} point={{ x: 16, y: 16 }} />
        <AssemblyCursor name="Codex" index={1} point={{ x: 144, y: 16 }} mode="grabbing" />
        <AssemblyCursor name="OpenCode" index={2} point={{ x: 272, y: 16 }} mode="text" />
      </chakra.svg>
    </Box>
  );
};
const meta = {
  title: "Landing/Agent Cursors",
  component: CursorModes,
} satisfies CanvasMeta<typeof CursorModes>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const PointerGrabAndText: Story = {
  id: "landing-agent-cursors--pointer-grab-and-text",
};
export const CommandBubbles: Story = {
  id: "landing-agent-cursors--command-bubbles",
  render: () => {
    const styles = useSlotRecipe({ recipe: landingAssemblySlotRecipe })({});
    return (
      <Box width="80" height="28">
        <chakra.svg css={styles.scene} data-assembly-ready="true" viewBox="0 0 320 112">
          <AssemblyCursor
            name="Claude"
            index={0}
            point={{ x: 0, y: 0 }}
            mode="chat"
            command="$ pst shaders update --scale 16 --speed 1.2"
            result="✓ Preview updated"
          />
          <AssemblyCursor
            name="Codex"
            index={1}
            point={{ x: 0, y: 40 }}
            mode="chat"
            command="$ pst icons rename --id component --name component-glow"
            result="✓ Icon renamed"
          />
          <AssemblyCursor
            name="OpenCode"
            index={2}
            point={{ x: 0, y: 80 }}
            mode="chat"
            command='$ pst tickets update --id TOOL-18 --status "In Progress"'
            result="✓ Ticket moved to In progress"
          />
        </chakra.svg>
      </Box>
    );
  },
};
