import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";

export type KilnVector = [number, number, number];

export interface KilnObject {
  id: string;
  name: string;
  kind: "camera" | "light" | "mesh";
  icon: string;
  tint: "blue" | "orange" | "purple" | "yellow";
  position: KilnVector;
  rotation: KilnVector;
  scale: KilnVector;
}

export const kilnPage: PageRef = {
  extensionId: "pstdio.extension-lab",
  kind: "page",
  id: "kiln-resource",
};

export const kilnObjects: KilnObject[] = [
  {
    id: "cube",
    name: "Cube",
    kind: "mesh",
    icon: "Box",
    tint: "orange",
    position: [-1.4, 0, 1],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },
  {
    id: "sphere",
    name: "Sphere",
    kind: "mesh",
    icon: "Circle",
    tint: "purple",
    position: [1.7, 0.3, 1.1],
    rotation: [0, 0, 0],
    scale: [1.1, 1.1, 1.1],
  },
  {
    id: "key-light",
    name: "Key Light",
    kind: "light",
    icon: "Sun",
    tint: "yellow",
    position: [-3.5, 1.8, 5.6],
    rotation: [24, 0, -38],
    scale: [1, 1, 1],
  },
  {
    id: "camera",
    name: "Camera",
    kind: "camera",
    icon: "Video",
    tint: "blue",
    position: [-4.2, -3, 2.2],
    rotation: [63, 0, -42],
    scale: [1, 1, 1],
  },
];

export const kilnResource = (object: KilnObject): ResourceRef => ({
  type: "kiln.object",
  id: object.id,
  label: object.name,
});
