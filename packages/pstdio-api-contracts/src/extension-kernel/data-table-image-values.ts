// Self-contained: `collections` consumers such as the UI must not load the extension kernel types.
interface DataTableImageItem {
  src: string;
  alt?: string;
}

const toImageItem = (value: unknown): DataTableImageItem[] => {
  if (typeof value === "string") return value ? [{ src: value }] : [];
  if (!value || typeof value !== "object" || !("src" in value) || typeof value.src !== "string" || !value.src)
    return [];
  return "alt" in value && typeof value.alt === "string" ? [{ src: value.src, alt: value.alt }] : [{ src: value.src }];
};

/** Images in a cell, in order. Entries without a usable source are skipped. */
export const readDataTableImageValue = (value: unknown) =>
  Array.isArray(value) ? value.flatMap(toImageItem) : toImageItem(value);

const fileName = (src: string) => {
  if (src.startsWith("data:")) return "";
  return src.split(/[?#]/)[0]?.split("/").pop() ?? "";
};

/** What sorting, filtering and search compare: alt text, or the file name without one. */
export const dataTableImageText = (value: unknown) =>
  readDataTableImageValue(value)
    .map((image) => image.alt ?? fileName(image.src))
    .filter(Boolean)
    .join(", ");
