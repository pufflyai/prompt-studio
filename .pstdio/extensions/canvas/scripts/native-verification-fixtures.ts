import { type CanvasDefinition, canvases } from "../src/canvases/definitions";
import { documentationFixture, interactionFixture } from "../src/canvases/verification-fixtures";
export const populatedVerification: CanvasDefinition = {
  id: "verification-populated",
  name: "Populated verification",
  items: Array.from({ length: 24 }, (_, index) => ({
    ...interactionFixture.items[index % 2],
    id: `populated-${index}`,
    name: `Interactive preview ${index + 1}`,
    position: { x: (index % 6) * 440, y: Math.floor(index / 6) * 500 },
  })),
};
export const verificationCanvases = [...canvases, interactionFixture, documentationFixture, populatedVerification];
