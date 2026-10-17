import {
  defineCommand,
  defineExtension,
  params,
  type StorageGroup,
  type StorageResolution,
} from "@pstdio/sdk/extensions";

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

const inspect = defineCommand({
  id: "inspect",
  title: "Inspect a retained note",
  params: { conflictId: params.text({ required: true }) },
  run: (ctx, { conflictId }) => ctx.storage.records.inspect(conflictId),
});

const resolve = defineCommand({
  id: "resolve",
  title: "Resolve a retained note",
  mutating: true,
  params: { proposal: params.json<StorageResolution, { required: true }>({ required: true }) },
  run: (ctx, { proposal }) => ctx.storage.records.resolve(proposal),
});

const outcome = defineCommand({
  id: "outcome",
  title: "Read a durable save outcome",
  params: { operationId: params.text({ required: true }) },
  run: (ctx, { operationId }) => ctx.storage.records.outcome(operationId),
});

export default defineExtension({ commands: [read, stage, commit, inspect, resolve, outcome] });
