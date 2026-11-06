export type ParameterValue = string | number | boolean;
export type ParameterValues = Record<string, ParameterValue>;
export type CanvasControl = { label?: string; description?: string } & (
  | { type: "number"; min: number; max: number; step?: number }
  | { type: "boolean" }
  | { type: "select"; options: readonly { value: string; label: string }[] }
);
export type CanvasControls = Record<string, CanvasControl>;
export interface CanvasMotion {
  duration: number;
  fps?: number;
  markers?: readonly { at: number; label: string }[];
}
/** A JSON design file beside this canvas. Saving is an explicit host action. */
export interface CanvasSave {
  file: string;
  key?: string;
}

export const parameterValues = (controls: CanvasControls, before: Record<string, unknown>, change: ParameterValues) => {
  const values = { ...before };
  for (const [key, value] of Object.entries(change)) {
    if (!Object.hasOwn(controls, key)) throw new Error(`Unknown frame parameter: ${key}`);
    const field = controls[key];
    if (field.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Enter a number for ${key}`);
      const bounded = Math.max(field.min, Math.min(field.max, value));
      const step = field.step ?? 1;
      values[key] = Math.max(
        field.min,
        Math.min(field.max, Number((field.min + Math.round((bounded - field.min) / step) * step).toPrecision(12))),
      );
    } else if (field.type === "boolean") {
      if (typeof value !== "boolean") throw new Error(`Choose on or off for ${key}`);
      values[key] = value;
    } else {
      if (typeof value !== "string" || !field.options.some((option) => option.value === value))
        throw new Error(`Choose an option for ${key}`);
      values[key] = value;
    }
  }
  return values;
};
