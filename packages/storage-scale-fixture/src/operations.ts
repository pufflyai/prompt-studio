import { createRow, type FixtureRow, type Workload } from "./fixture";

export interface FixtureChange {
  rows: FixtureRow[];
  deleted: string[];
  restore: boolean;
}

export const editOperation = (
  kind: Workload,
  operation: string,
  nonce: string,
  count: number,
  ordinal = 37,
  owner = 0,
) => {
  const base = createRow(kind, owner, ordinal, 3);
  let expected: FixtureRow | null = { ...base, title: `Saved ${nonce}` };
  switch (operation) {
    case "short":
    case "direct-sdk-first-write":
      break;
    case "indexed":
      expected = { ...base, ordinal: base.ordinal + 1 };
      break;
    case "tag":
      expected = { ...base, tags: [...base.tags, `edit-${nonce}`] };
      break;
    case "nested":
      expected = { ...base, details: { ...base.details, progress: 4 } };
      break;
    case "multiline":
      if (!("content" in base)) throw new Error("Small rows have no multiline body");
      expected = { ...base, content: `${base.content}\nSaved ${nonce}\n` };
      break;
    case "insert":
      expected = { ...createRow(kind, owner, count + 37, 3), id: `insert-${nonce}`, rank: -1 };
      break;
    case "delete":
      expected = null;
      break;
    default:
      throw new Error(`Unknown edit ${operation}`);
  }
  const recordId = expected?.id ?? base.id;
  const change: FixtureChange = {
    rows: expected ? [expected] : [],
    deleted: expected ? [] : [recordId],
    restore: false,
  };
  const restore: FixtureChange = {
    rows: operation === "insert" ? [] : [base],
    deleted: operation === "insert" ? [recordId] : [],
    restore: operation === "delete",
  };
  return { recordId, expected, change, restore };
};

export const rowSummary = (row: FixtureRow) =>
  `${row.ordinal} | ${row.tags.join(", ")} | ${row.details.progress ?? ""} | ${"content" in row ? row.content.trim().split("\n").at(-1) : ""}`;
