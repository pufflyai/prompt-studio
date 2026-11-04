import { defineCommand, params } from "@pstdio/sdk/extensions";

const shape = {
  title: "Before",
  status: "ready",
  nested: { left: 1, right: 1 },
  items: [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
  ],
  body: "first\nlast",
};
const seed = defineCommand({
  id: "seed-acceptance",
  title: "Seed acceptance records",
  mutating: true,
  async run(ctx) {
    let position: string | undefined;
    const cards = ["a", "b", "c"].map((id) => {
      position = ctx.storage.positions.between(position);
      return { recordId: `card-${id}`, replace: { position } };
    });
    return ctx.storage.records.commit({
      operationId: ctx.storage.ids.create(),
      edits: [
        { recordId: "shape", replace: shape },
        ...cards,
        ...["atomic-a", "atomic-b"].map((recordId) => ({ recordId, replace: 0 })),
      ],
    });
  },
});
const edit = defineCommand({
  id: "edit-acceptance",
  title: "Edit independent fields offline",
  mutating: true,
  params: { side: params.text({ required: true }) },
  async run(ctx, { side }) {
    const row = await ctx.storage.records.read("shape");
    const value = row.value as typeof shape;
    const left = side === "left";
    return ctx.storage.records.commit({
      operationId: ctx.storage.ids.create(),
      edits: [
        {
          recordId: row.recordId,
          replace: {
            ...value,
            ...(left ? { title: "Left title" } : { status: "right" }),
            nested: { ...value.nested, [side]: 2 },
            items: value.items.map((item) =>
              item.id === (left ? "a" : "b") ? { ...item, title: `Edited ${item.id.toUpperCase()}` } : item,
            ),
            body: left ? "FIRST\nlast" : "first\nLAST",
          },
        },
      ],
    });
  },
});
const migrate = defineCommand({
  id: "migrate-acceptance",
  title: "Migrate the same sources offline",
  mutating: true,
  async run(ctx) {
    const storage = ctx.storage.scope({ type: "acceptance", id: "migration" });
    const ids: string[] = [];
    await storage.migrate(1, async (_, migration) => {
      for (const key of ["source-a", "source-b"]) {
        const id = migration.id(key);
        ids.push(id);
        await storage.records.commit({ operationId: id, edits: [{ recordId: id, replace: { imported: key } }] });
      }
    });
    return ids;
  },
});
const move = defineCommand({
  id: "move-acceptance",
  title: "Move the same cards offline",
  mutating: true,
  async run(ctx) {
    const before = (await ctx.storage.records.read("card-b")).value as { position: string };
    const after = (await ctx.storage.records.read("card-c")).value as { position: string };
    return ctx.storage.records.commit({
      operationId: ctx.storage.ids.create(),
      edits: ["card-a", "card-c"].map((recordId) => ({
        recordId,
        replace: { position: ctx.storage.positions.between(before.position, after.position) },
      })),
    });
  },
});
const read = defineCommand({
  id: "read-acceptance",
  title: "Read acceptance records",
  async run(ctx) {
    const rows = await ctx.storage.records.list();
    const cards = rows.filter((row) => row.recordId.startsWith("card-"));
    cards.sort((a, b) => {
      const left = (a.value as { position: string }).position;
      const right = (b.value as { position: string }).position;
      if (left === right) return 0;
      return left < right ? -1 : 1;
    });
    return {
      shape: rows.find((row) => row.recordId === "shape"),
      cards,
      migrated: rows
        .filter((row) => (row.value as { imported?: string } | null)?.imported)
        .sort((a, b) => (a.recordId < b.recordId ? -1 : 1)),
      atomic: rows.filter((row) => row.recordId.startsWith("atomic-")).map((row) => row.value),
    };
  },
});
const atomic = defineCommand({
  id: "atomic-acceptance",
  title: "Save an atomic record pair",
  mutating: true,
  params: { version: params.number({ required: true }) },
  run: (ctx, { version }) =>
    ctx.storage.records.commit({
      operationId: ctx.storage.ids.create(),
      edits: ["atomic-a", "atomic-b"].map((recordId) => ({ recordId, replace: version })),
    }),
});
const readRecords = defineCommand({
  id: "read-acceptance-records",
  title: "Read an atomic record snapshot",
  params: { ids: params.json<string[], { required: true }>({ required: true }) },
  run: (ctx, { ids }) => ctx.storage.records.readMany(ids),
});
const readAsset = defineCommand({
  id: "read-acceptance-asset",
  title: "Read the offline referenced asset",
  async run(ctx) {
    const record = await ctx.storage.records.read("offline-asset");
    if (!record.asset) throw new Error("Offline asset reference is missing");
    return new Response(await ctx.storage.assets.read(record.asset)).text();
  },
});
export const cloudAcceptanceCommands = [seed, edit, migrate, move, read, atomic, readRecords, readAsset];
