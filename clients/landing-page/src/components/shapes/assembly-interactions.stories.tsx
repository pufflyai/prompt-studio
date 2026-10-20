import { Box, Button, chakra, Stack, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useRef, useState } from "react";
import { ASSEMBLY_AGENTS } from "../../content/tool-assembly";
import { TOOL_EXAMPLES, type ToolExampleId } from "../../content/tool-examples-content";
import { createAssemblyInteractions } from "../../services/shapes/assembly-interactions";
import { BOARD_PREVIEW_HEIGHT, BOARD_WIDTH, SLOT_TRAY_HEIGHT } from "../../services/shapes/assembly-layout";
import { landingAssemblySlotRecipe } from "../../theme/recipes/landing-assembly";
import { AssemblyCursor } from "./assembly-cursor";
import { ToolBoard } from "./tool-board";

interface InteractionPreviewProps {
  example: ToolExampleId;
  scale: number;
}

const InteractionPreview = (props: InteractionPreviewProps) => {
  const { example, scale } = props;
  const ref = useRef<SVGSVGElement>(null);
  const styles = useSlotRecipe({ recipe: landingAssemblySlotRecipe })({});
  const definition = TOOL_EXAMPLES.find((item) => item.id === example)!;
  const width = BOARD_WIDTH * scale;
  const height = BOARD_PREVIEW_HEIGHT * scale + SLOT_TRAY_HEIGHT;
  useEffect(() => {
    const scene = ref.current!;
    const agents = ASSEMBLY_AGENTS.map((_, index) => ({
      position: { x: 40 + index * 60, y: 40 },
      element: scene.querySelector<SVGGElement>(`[data-assembly-cursor="${index}"]`)!,
    }));
    const interactions = createAssemblyInteractions(scene, agents);
    const started = performance.now();
    const observer = new ResizeObserver(() => interactions.resize(performance.now() - started));
    observer.observe(scene);
    let frame = 0;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const update = (now: number) => {
      if (!motion.matches) interactions.update(now - started, example, () => true);
      for (const [index, agent] of agents.entries()) {
        agent.element.dataset.cursorMode = interactions.mode(index);
        agent.element.setAttribute("transform", `translate(${agent.position.x + 5} ${agent.position.y + 5})`);
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      interactions.reset();
    };
  }, [example]);
  return (
    <Box width={width} maxWidth="full">
      <chakra.svg
        ref={ref}
        css={styles.scene}
        width="full"
        height="auto"
        viewBox={`0 0 ${width} ${height}`}
        data-assembly-ready="true"
      >
        <ToolBoard
          x={0}
          y={0}
          scale={scale}
          unitScale={1}
          view={{ example, parts: definition.blocks.map((block) => block.kind) }}
        />
        {ASSEMBLY_AGENTS.map((name, index) => (
          <AssemblyCursor key={name} name={name} index={index} point={{ x: 40 + index * 60, y: 40 }} />
        ))}
      </chakra.svg>
    </Box>
  );
};

const meta = {
  title: "Landing/Workbench Interactions",
  component: InteractionPreview,
  args: { example: "icons", scale: 1 },
  parameters: { layout: "centered" },
} satisfies Meta<typeof InteractionPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const RenameWithInspectorRemount: Story = {};
export const NarrowRename: Story = { args: { scale: 0.5 } };
export const AgentSessions: Story = { args: { example: "agents" } };
export const NarrowAgentSessions: Story = { args: { example: "agents", scale: 0.5 } };
export const LargeAgentSessions: Story = { args: { example: "agents", scale: 1.8 } };

const ResizableShaderPreview = () => {
  const [narrow, setNarrow] = useState(false);
  return (
    <Stack gap="md" align="start">
      <Button onClick={() => setNarrow(!narrow)}>Resize preview</Button>
      <Box width={narrow ? "80" : "3xl"} maxWidth="full">
        <InteractionPreview example="shaders" scale={1} />
      </Box>
    </Stack>
  );
};

export const ShaderTypingDuringResize: Story = {
  args: { example: "shaders" },
  render: () => <ResizableShaderPreview />,
  parameters: {
    docs: {
      description: {
        story: "Resize while Codex types. Entered shader text stays in place while the cursor reaches the moved field.",
      },
    },
  },
};
