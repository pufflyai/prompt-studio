import type { MarmaladeLayer, MarmaladeProperties } from "./marmalade.types";
import { range } from "./marmalade-layers";

export const validateColor = (value: unknown) => {
  if (typeof value !== "string" || !/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(value))
    throw new Error("Use a hex color");
};
const choice = (value: unknown, options: string[]) => {
  if (typeof value !== "string" || !options.includes(value)) throw new Error("Unknown property value");
};
interface PropertyRule {
  kinds?: MarmaladeLayer["kind"][];
  validate(value: unknown): void;
}
const drawable: MarmaladeLayer["kind"][] = ["image", "text", "shape", "brush"];
const rules: Record<keyof MarmaladeProperties, PropertyRule> = {
  name: {
    validate: (value) => {
      if (typeof value !== "string" || !value.trim()) throw new Error("Give the layer a name");
    },
  },
  width: { kinds: drawable, validate: (value) => range(value as number, 1, 10000) },
  height: { kinds: drawable, validate: (value) => range(value as number, 1, 10000) },
  rotation: { kinds: drawable, validate: (value) => range(value as number, -360, 360) },
  color: { kinds: ["text", "shape", "brush"], validate: validateColor },
  fontSize: { kinds: ["text"], validate: (value) => range(value as number, 1, 500) },
  fontFamily: { kinds: ["text"], validate: (value) => choice(value, ["sans-serif", "serif", "monospace"]) },
  fontWeight: { kinds: ["text"], validate: (value) => choice(value, ["400", "700"]) },
  align: { kinds: ["text"], validate: (value) => choice(value, ["left", "center", "right"]) },
  strokeWidth: { kinds: ["brush"], validate: (value) => range(value as number, 1, 100) },
};
export const setMarmaladeProperties = (layer: MarmaladeLayer, changes: Partial<MarmaladeProperties>) => {
  for (const [key, value] of Object.entries(changes)) {
    if (!Object.hasOwn(rules, key)) throw new Error("Unknown layer property");
    const rule = rules[key as keyof MarmaladeProperties];
    if (rule.kinds && !rule.kinds.includes(layer.kind)) throw new Error("This property does not apply to the layer");
    rule.validate(value);
    if ((key === "width" || key === "height") && layer.points) {
      const ratio = (value as number) / layer[key];
      for (const point of layer.points) point[key === "width" ? 0 : 1] *= ratio;
    }
    Object.assign(layer, { [key]: key === "name" ? String(value).trim() : value });
  }
};
