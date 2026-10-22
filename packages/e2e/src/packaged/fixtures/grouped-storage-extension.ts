import {
  accountEvents,
  defineCommand,
  defineExtension,
  defineHook,
  defineResourceKind,
  params,
  resourceEvents,
  type StorageGroup,
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

const allocate = defineCommand({
  id: "allocate",
  title: "Allocate identity",
  mutating: true,
  run: (ctx) => ctx.resources.allocate({ kind: "note" }),
});
const identity = defineCommand({
  id: "identity",
  title: "Read identity",
  params: { id: params.text({ required: true }) },
  run: (ctx, { id }) => ctx.resources.identity({ kind: "note", id }),
});
const find = defineCommand({
  id: "find-number",
  title: "Find identity",
  params: { shorthand: params.text({ required: true }) },
  run: (ctx, { shorthand }) => ctx.resources.findByShorthand({ kind: "note", shorthand }),
});
// Sync events stay in memory. Saving them would change the sync status the hook observes.
const syncEvents: string[] = [];
const recordSyncEvent = defineHook({
  id: "record-sync-event",
  event: accountEvents.projectSyncChanged,
  run: (_ctx, payload) => {
    syncEvents.push(payload.state);
  },
});
const syncHistory = defineCommand({
  id: "sync-history",
  title: "Read sync status events",
  run: async (ctx) => ({ events: syncEvents, current: await ctx.account.projectSyncStatus() }),
});
// The compiled host must expose this public event reference as well as the methods.
const numberEvent = defineCommand({ id: "number-event", title: "Number event", run: () => resourceEvents.renumbered });
export default defineExtension({
  resourceKinds: [defineResourceKind({ id: "note", prefix: "NR" })],
  commands: [read, stage, commit, outcome, checkReadCache, allocate, identity, find, numberEvent, syncHistory],
  hooks: [recordSyncEvent],
});
