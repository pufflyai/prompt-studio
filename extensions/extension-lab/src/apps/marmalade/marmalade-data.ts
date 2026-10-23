import type { MarmaladeLayer, MarmaladeState } from "./marmalade.types";

const layer = (input: Pick<MarmaladeLayer, "id" | "name" | "kind"> & Partial<MarmaladeLayer>) => ({
  visible: true,
  locked: false,
  x: 0,
  y: 0,
  width: 1200,
  height: 810,
  opacity: 1,
  ...input,
});

export const createMarmaladeState = () => {
  const state: MarmaladeState = {
    document: {
      id: "great-wave",
      title: "Great Wave",
      width: 1200,
      height: 810,
      layers: [
        layer({ id: "caption", name: "Caption", kind: "group", x: 60, y: 600, width: 680, height: 150 }),
        layer({
          id: "title",
          name: "Title",
          kind: "text",
          parentId: "caption",
          x: 85,
          y: 620,
          width: 630,
          height: 54,
          text: "The Great Wave",
        }),
        layer({
          id: "credit",
          name: "Credit",
          kind: "text",
          parentId: "caption",
          x: 85,
          y: 690,
          width: 630,
          height: 30,
          text: "Katsushika Hokusai · c. 1831 · public domain",
        }),
        layer({
          id: "card",
          name: "Caption Card",
          kind: "shape",
          parentId: "caption",
          x: 60,
          y: 600,
          width: 680,
          height: 150,
          opacity: 0.9,
        }),
        layer({
          id: "reference",
          name: "Reference unavailable",
          kind: "image",
          visible: false,
          locked: true,
          disabled: true,
        }),
        layer({ id: "artwork", name: "Great Wave", kind: "image", mask: true }),
      ],
    },
    selectedIds: ["title"],
    expandedIds: ["caption"],
    tool: "move",
    zoom: 1,
    pan: { x: 0, y: 0 },
  };
  return state;
};
