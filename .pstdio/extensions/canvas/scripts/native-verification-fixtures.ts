import { type CanvasDefinition, canvases } from "../src/canvases/definitions";
export const populatedVerification: CanvasDefinition = {
  id: "verification-populated",
  name: "Populated verification",
  items: Array.from({ length: 24 }, (_, index) => ({
    ...canvases[0].items[index % 2],
    id: `populated-${index}`,
    name: `Interactive preview ${index + 1}`,
    position: { x: (index % 6) * 440, y: Math.floor(index / 6) * 500 },
  })),
};
export const verificationCanvases = [...canvases, populatedVerification];
