// Optional metadata advertised by a project's newer frame runtime. Older builds keep rendering
// normally; they simply do not advertise editable parameters.
export type Value = string | number | boolean;
export type Values = Record<string, Value>;
export type Control = { label?: string; description?: string } & (
  | { type: "number"; min: number; max: number; step?: number }
  | { type: "boolean" }
  | { type: "select"; options: { value: string; label: string }[] }
);
export interface FrameParameters {
  controls: Record<string, Control>;
  values: Values;
  motion?: { duration: number; fps?: number; markers?: { at: number; label: string }[] };
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const readControl = (key: string, raw: unknown): Control | undefined => {
  const field = object(raw);
  const base = {
    label: typeof field.label === "string" ? field.label : key,
    description: typeof field.description === "string" ? field.description : undefined,
  };
  if (field.type === "boolean") return { ...base, type: "boolean" };
  if (
    field.type === "number" &&
    typeof field.min === "number" &&
    Number.isFinite(field.min) &&
    typeof field.max === "number" &&
    Number.isFinite(field.max) &&
    field.max >= field.min
  ) {
    return {
      ...base,
      type: "number",
      min: field.min,
      max: field.max,
      step: typeof field.step === "number" && field.step > 0 && Number.isFinite(field.step) ? field.step : 1,
    };
  }
  if (field.type === "select" && Array.isArray(field.options)) {
    const options = field.options
      .map(object)
      .flatMap((option) =>
        typeof option.value === "string" && typeof option.label === "string"
          ? [{ value: option.value, label: option.label }]
          : [],
      );
    if (options.length) return { ...base, type: "select", options };
  }
};
export const readParameters = (information: unknown) => {
  const info = object(information);
  const controls: Record<string, Control> = {};
  for (const [key, raw] of Object.entries(object(info.controls))) {
    const control = readControl(key, raw);
    if (control) controls[key] = control;
  }
  const values = Object.fromEntries(
    Object.entries(object(info.values)).filter(
      ([, value]) =>
        typeof value === "string" ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value)),
    ),
  ) as Values;
  const motion = object(info.motion);
  return {
    controls,
    values,
    ...(typeof motion.duration === "number" && motion.duration > 0 && motion.duration <= 120
      ? {
          motion: {
            duration: motion.duration,
            fps: typeof motion.fps === "number" && motion.fps > 0 && motion.fps <= 120 ? motion.fps : 60,
            markers: Array.isArray(motion.markers)
              ? motion.markers
                  .map(object)
                  .flatMap((marker) =>
                    typeof marker.at === "number" &&
                    marker.at >= 0 &&
                    marker.at <= Number(motion.duration) &&
                    typeof marker.label === "string"
                      ? [{ at: marker.at, label: marker.label }]
                      : [],
                  )
              : [],
          },
        }
      : {}),
  };
};

export const nextPlaybackTime = (time: number, delta: number, start: number, end: number, loop: boolean) => {
  const next = Math.max(start, time) + delta;
  if (end <= start) return start;
  return loop ? start + ((next - start) % (end - start)) : Math.min(end, next);
};
