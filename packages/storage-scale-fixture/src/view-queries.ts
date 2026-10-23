import type { Selection } from "./fixture";

// Every layer measures the same declared indexes and predicates, so their timings compare.
type FieldType = "string" | "number" | "array";

const indexFields: Record<string, { path: string[]; type: FieldType }> = {
  id: { path: ["id"], type: "string" },
  title: { path: ["title"], type: "string" },
  ordinal: { path: ["ordinal"], type: "number" },
  owner: { path: ["owner"], type: "number" },
  rank: { path: ["rank"], type: "number" },
  tags: { path: ["tags"], type: "array" },
  progress: { path: ["details", "progress"], type: "number" },
  content: { path: ["content"], type: "string" },
  shorthand: { path: ["shorthand"], type: "string" },
};

export const scaleStorageIndexes = (planner = false) => {
  const fields = Object.fromEntries(
    Object.entries(indexFields).map(([name, field]) => [
      name,
      { ...field, path: planner ? ["value", ...field.path] : field.path },
    ]),
  );
  const directions = ["asc", "desc"] as const;
  return [
    {
      name: "scale-rows",
      fields,
      equality: ["ordinal"],
      orderBy: [
        { field: "rank", direction: "asc" as const },
        { field: "id", direction: "asc" as const },
      ],
    },
    { name: "scale-identities", fields, equality: ["id"] },
    ...directions.map((direction) => ({
      name: `scale-title-${direction}`,
      fields,
      equality: ["ordinal"],
      orderBy: [
        { field: "title", direction },
        { field: "id", direction: "asc" as const },
      ],
    })),
  ];
};

// This is the frozen benchmark mutation domain, not a general modulo query API.
// Seed ordinals are [0,count); indexed edits add one; inserted rows use count+37.
export const scaleSelectionPredicate = (count: number, selection: Selection) => {
  const period = Math.max(1, Math.floor(count / (selection === "focus" ? 100 : 300)));
  const residue = Math.min(37, period - 1);
  const ordinals: number[] = [];
  for (let ordinal = residue; ordinal <= count; ordinal += period) ordinals.push(ordinal);
  const inserted = count + 37;
  if (inserted % period === residue) ordinals.push(inserted);
  return { field: "ordinal", op: "in" as const, value: ordinals };
};

type Predicate = ReturnType<typeof scaleSelectionPredicate>;

export const scaleScopePredicate = (planner: boolean, where?: Predicate) => ({
  all: [{ field: planner ? "shorthand" : "id", op: "exists" as const }, ...(where ? [where] : [])],
});

export const scaleViewFields = ["id", "title", "rank", "owner", "ordinal"];
