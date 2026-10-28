import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { TimelineFromJSON } from "./timeline";

const meta = {
  title: "Patterns/Chat/Timeline",
  component: TimelineFromJSON,
  parameters: { layout: "padded" },
} satisfies CanvasMeta<typeof TimelineFromJSON>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Diff: Story = {
  id: "patterns-chat-timeline--diff",
  args: {
    data: {
      items: [
        {
          title: [{ kind: "text", text: "Updated greeting" }],
          blocks: [
            {
              type: "diff",
              language: "typescript",
              original: 'const greeting = "hello";\n',
              modified: 'const greeting = "welcome";\n',
            },
          ],
        },
      ],
    },
  },
};
