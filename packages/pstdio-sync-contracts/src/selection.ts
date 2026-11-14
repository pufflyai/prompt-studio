/** Independent choice paths retain removals and the scalar consumed by a type conversion. */
export type StorageSelection = (
  | { type: "single"; value: string | null; replacedOptions?: Record<string, boolean> }
  | { type: "multi"; value?: string | null; replacedValue?: string | null }
) & { options?: Record<string, boolean> };

const object = (value: unknown) =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
const values = (value: unknown) => {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
};

/** Resolve both channels without erasing an offline edit. Concurrent option keys have deterministic UTF-16 order. */
export const resolveSelectedValues = (legacy: unknown, input?: unknown) => {
  const selection = object(input);
  if (!selection || !["single", "multi"].includes(String(selection.type))) return values(legacy);
  const options = object(selection.options) ?? {};
  const replaced = selection.type === "single" ? object(selection.replacedOptions) : undefined;
  const visible = new Map<string, boolean>(
    Object.keys(options)
      .sort()
      .flatMap((id) => {
        const value = options[id];
        return typeof value === "boolean" && (!replaced || replaced[id] !== value) ? [[id, value] as const] : [];
      }),
  );
  const previous = selection.type === "single" ? values(selection.value) : values(legacy);
  const selected = [...new Set([...previous, ...visible.keys()])].filter(
    (id) => visible.get(id) ?? previous.includes(id),
  );
  if (
    selection.type === "multi" &&
    typeof selection.value === "string" &&
    selection.value !== selection.replacedValue &&
    !selected.includes(selection.value)
  )
    selected.push(selection.value);
  return selected;
};
