import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ToolBoard } from "../../components/shapes/tool-board";
import { BOARD_PREVIEW_HEIGHT, BOARD_WIDTH, SLOT_TRAY_HEIGHT } from "../../services/shapes/assembly-layout";

const meta = {
  title: "Theme/Progressive Tool Board",
  component: ToolBoard,
  parameters: { layout: "centered" },
  args: { x: 0, y: 0, scale: 1, unitScale: 1, view: { example: "icons", parts: [] } },
  decorators: [
    (Story, { args }) => (
      <svg
        width={BOARD_WIDTH * (args.unitScale ?? 1) * (args.scale ?? 1)}
        height={BOARD_PREVIEW_HEIGHT * (args.unitScale ?? 1) * (args.scale ?? 1) + SLOT_TRAY_HEIGHT}
        viewBox={`0 0 ${BOARD_WIDTH * (args.unitScale ?? 1) * (args.scale ?? 1)} ${BOARD_PREVIEW_HEIGHT * (args.unitScale ?? 1) * (args.scale ?? 1) + SLOT_TRAY_HEIGHT}`}
        aria-label="Tool assembly preview"
      >
        <Story />
      </svg>
    ),
  ],
} satisfies CanvasMeta<typeof ToolBoard>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Empty: Story = {
  id: "theme-progressive-tool-board--empty",
};
export const PageAdded: Story = {
  id: "theme-progressive-tool-board--page-added",
  args: { view: { example: "icons", parts: ["page"] } },
};
export const InspectorAdded: Story = {
  id: "theme-progressive-tool-board--inspector-added",
  args: { view: { example: "icons", parts: ["page", "editor"] } },
  parameters: {
    docs: { description: { story: "The inspector centers its glyph in a taller preview, including compact boards." } },
  },
};
export const IconsComplete: Story = {
  id: "theme-progressive-tool-board--icons-complete",
  args: { view: { example: "icons", parts: ["page", "editor", "command"] } },
};
export const NarrowIconsComplete: Story = {
  id: "theme-progressive-tool-board--narrow-icons-complete",
  args: { scale: 0.5, view: { example: "icons", parts: ["page", "editor", "command"] } },
};
export const LargeIconsComplete: Story = {
  id: "theme-progressive-tool-board--large-icons-complete",
  args: { scale: 1.8, view: { example: "icons", parts: ["page", "editor", "command"] } },
};
export const LargeDisplayIcons: Story = {
  id: "theme-progressive-tool-board--large-display-icons",
  args: { scale: 1.6, unitScale: 1.25, view: { example: "icons", parts: ["page", "editor", "command"] } },
};
export const ShadersComplete: Story = {
  id: "theme-progressive-tool-board--shaders-complete",
  args: { view: { example: "shaders", parts: ["page", "editor", "hook"] } },
};
export const LargeShadersComplete: Story = {
  id: "theme-progressive-tool-board--large-shaders-complete",
  args: { scale: 1.8, view: { example: "shaders", parts: ["page", "editor", "hook"] } },
};
export const AgentsComplete: Story = {
  id: "theme-progressive-tool-board--agents-complete",
  args: { view: { example: "agents", parts: ["page", "command", "skill", "hook", "automation"] } },
};
export const AgentSlotOutlines: Story = {
  id: "theme-progressive-tool-board--agent-slot-outlines",
  args: { view: { example: "agents", parts: [] } },
};
export const NarrowFiveSlots: Story = {
  id: "theme-progressive-tool-board--narrow-five-slots",
  args: { scale: 0.5, view: { example: "agents", parts: [] } },
};
export const FormulasComplete: Story = {
  id: "theme-progressive-tool-board--formulas-complete",
  args: { view: { example: "formulas", parts: ["page", "editor", "command"] } },
};
