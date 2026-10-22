export type Workload = "rich" | "small";
export type Selection = "focus" | "pages";
export const fixtureVersion = "ps903-v1";
export const epoch = "2026-01-01T00:00:00.000Z";

export const workload = (kind: Workload) => ({
  version: fixtureVersion,
  kind,
  ownerCount: 10,
  rows: kind === "rich" ? 10_000 : 100_000,
  backgroundRows: 100,
  edits: 3,
  pageSize: 100,
  churn: kind === "rich" ? 10_000 : 100_000,
  seedBatchRows: kind === "rich" ? 100 : 1_000,
});
export type WorkloadSpec = ReturnType<typeof workload>;

export const owners = (spec: WorkloadSpec) =>
  Array.from({ length: spec.ownerCount }, (_, index) => ({
    index,
    id: index === 9 ? "pstdio.pstdio-planner" : `scale.scale-owner-${index}`,
    rows: spec.kind === "rich" || index === 0 ? spec.rows : spec.backgroundRows,
  }));

export const rowId = (owner: number, index: number, churn = false) =>
  `${churn ? "churn" : "row"}-${owner}-${String(index).padStart(6, "0")}`;

// Permuting sort keys gives ties and makes page order differ from insertion order.
export const createRow = (kind: Workload, owner: number, index: number, history: number, churn = false) => {
  const id = rowId(owner, index, churn);
  const details: Record<string, number | boolean[]> = {};
  if (index % 10 === 0 || kind === "rich")
    Object.assign(details, { progress: history, checks: [true, false], team: index % 7 });
  const common = {
    id,
    owner,
    ordinal: index,
    title: `Resource ${id} revision ${history}`,
    rank: Math.floor(((index * 7919) % 100_003) / 3),
    history,
    enabled: index % 7 !== 0,
    category: `category-${index % 13}`,
    assignee: index % 5 === 0 ? null : `person-${index % 71}`,
    createdAt: epoch,
    updatedAt: `2026-01-01T00:00:0${history}.000Z`,
    tags: index % 10 === 0 || kind === "rich" ? [`tag-${index % 17}`, `team-${index % 7}`] : [],
    details,
  };
  if (kind === "small")
    return {
      ...common,
      code: `ACCOUNT-${String(index).padStart(6, "0")}`,
      amount: (index % 10_000) / 100,
      currency: "SEK",
      region: `region-${index % 19}`,
      customerId: `customer-${index % 997}`,
      projectId: `project-${index % 101}`,
      externalReference: `ledger:2026:invoice:${String(index).padStart(8, "0")}`,
      email: `account-${index}@scale.example`,
      dueAt: "2026-02-01T00:00:00.000Z",
      reconciled: index % 2 === 0,
      taxRate: 0.25,
    };
  const targetBytes = index % 20 === 0 ? 16_384 : 2_048;
  const row = { ...common, content: `# ${common.title}\n\nAcceptance details\nEdit ${history}\n` };
  const bytes = Buffer.byteLength(JSON.stringify(row));
  row.content += "abcdefghijklmnopqrstuvwxyz\n".repeat(Math.ceil((targetBytes - bytes) / 27));
  return row;
};
export type FixtureRow = ReturnType<typeof createRow>;

export const matches = (row: Pick<FixtureRow, "ordinal">, selection: Selection, count: number) => {
  const period = Math.max(1, Math.floor(count / (selection === "focus" ? 100 : 300)));
  return row.ordinal % period === Math.min(37, period - 1);
};

export const compareRows = (a: Pick<FixtureRow, "rank" | "id">, b: Pick<FixtureRow, "rank" | "id">) =>
  a.rank - b.rank || (a.id < b.id ? -1 : Number(a.id > b.id));

export const pageRows = (spec: WorkloadSpec, owner: number, selection: Selection, page: number) => {
  const count = owners(spec)[owner].rows;
  const rows = Array.from({ length: count }, (_, ordinal) => ({ ordinal }))
    .filter((row) => matches(row, selection, count))
    .map(({ ordinal }) => createRow(spec.kind, owner, ordinal, spec.edits));
  return rows.sort(compareRows).slice(page * 100, (page + 1) * 100);
};
