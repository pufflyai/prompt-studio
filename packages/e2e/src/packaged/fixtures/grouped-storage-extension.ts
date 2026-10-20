import { defineCommand, defineExtension, params, type StorageGroup } from "@pstdio/sdk/extensions";

const read = defineCommand({
  id: "read",
  title: "Read shared notes",
  async run(ctx) {
    const records = ctx.storage.records;
    return {
      note: await records.read(records.id("note")),
      caption: await records.read(records.id("caption")),
    };
  },
});

const stage = defineCommand({
  id: "stage",
  title: "Stage a note image",
  mutating: true,
  params: { operationId: params.text({ required: true }), content: params.text({ required: true }) },
  run: (ctx, input) =>
    ctx.storage.assets.stage({
      operationId: input.operationId,
      source: new Blob([input.content], { type: "application/example" }),
    }),
});

const commit = defineCommand({
  id: "commit",
  title: "Save shared notes",
  mutating: true,
  params: { group: params.json<StorageGroup, { required: true }>({ required: true }) },
  run: (ctx, { group }) => ctx.storage.records.commit(group),
});

const outcome = defineCommand({
  id: "outcome",
  title: "Read a durable save outcome",
  params: { operationId: params.text({ required: true }) },
  run: (ctx, { operationId }) => ctx.storage.records.outcome(operationId),
});

const checkReadCache = defineCommand({
  id: "check-read-cache",
  title: "Check record reads across unrelated saves",
  mutating: true,
  async run(ctx) {
    const records = ctx.storage.records;
    const before = await records.read(records.id("caption"));
    await ctx.storage.set("fixed", { saved: true });
    for (let index = 0; index < 20; index++) {
      const recordId = records.id(`unrelated-${index}`);
      await records.commit({
        operationId: `unrelated-${index}`,
        edits: [{ recordId, expectedRevision: (await records.read(recordId)).revision, replace: index }],
      });
    }
    const reads = [];
    for (let repeat = 0; repeat < 3; repeat++)
      reads.push({ record: await records.read(before.recordId), legacy: await ctx.storage.get("fixed") });
    return { before, reads };
  },
});

export default defineExtension({
  commands: [read, stage, commit, outcome, checkReadCache],
});
