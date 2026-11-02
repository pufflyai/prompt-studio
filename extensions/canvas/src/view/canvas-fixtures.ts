import type { CanvasDefinition, CanvasItem } from "../canvas-model";

// Prompt Studio's own design pages, shown inside UI Canvas to document UI Canvas itself.
interface FrameInput {
  id: string;
  name: string;
  source: string;
  exportName: string;
  x: number;
  width: number;
  height: number;
}
const frame = (input: FrameInput): CanvasItem => {
  const { id, name, source, exportName, x, width, height } = input;
  return {
    id,
    name,
    position: { x, y: 0 },
    width,
    height,
    preview: { source, exportName, viewportHeight: 960, revision: "" },
  };
};

const previews = "packages/ui/src/foundations/interactive-previews.canvas.tsx";

export const interactionFixture: CanvasDefinition = {
  id: "playground",
  name: "Design playground",
  group: "",
  items: [
    frame({
      id: "project-form",
      name: "Project form · default",
      source: previews,
      exportName: "ProjectForm",
      x: 0,
      width: 360,
      height: 320,
    }),
    frame({
      id: "controls",
      name: "Shared controls · interactive",
      source: previews,
      exportName: "Controls",
      x: 440,
      width: 360,
      height: 400,
    }),
  ],
};

export const documentationFixture: CanvasDefinition = {
  id: "documentation-contract",
  name: "Documentation panels",
  group: "",
  items: [
    frame({
      id: "long-documentation",
      name: "Long documentation · intrinsic height",
      source: "packages/ui/src/foundations/documentation.canvas.tsx",
      exportName: "LongDocumentation",
      x: 0,
      width: 640,
      height: 240,
    }),
  ],
};

export const populatedFixture: CanvasDefinition = {
  id: "populated",
  name: "Populated verification",
  group: "",
  items: Array.from({ length: 24 }, (_, index) => ({
    ...interactionFixture.items[index % 2]!,
    id: `preview-${index}`,
    name: `Interactive preview ${index + 1}`,
    position: { x: (index % 6) * 440, y: Math.floor(index / 6) * 500 },
  })),
};
