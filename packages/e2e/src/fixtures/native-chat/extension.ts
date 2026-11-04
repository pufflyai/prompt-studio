import {
  type ChatDraft,
  type ChatRendererSnapshot,
  defineCommand,
  defineExtension,
  definePage,
  defineView,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const initial: ChatRendererSnapshot = { messages: [], values: {}, controls: [] };
const watch = defineCommand({
  id: "watch",
  title: "Watch conversation",
  stream: { kind: "stream" },
  async run(ctx) {
    await ctx.stream.write({ revision: 0, snapshot: { notice: "Live stream connected" } });
    if (!ctx.signal.aborted)
      await new Promise<void>((done) => ctx.signal.addEventListener("abort", () => done(), { once: true }));
  },
});
const conversation = defineView({
  id: "conversation",
  title: "Native conversation",
  body: {
    kind: "chat",
    draftKey: "compose",
    initial,
    stream: watch.ref,
    async query(ctx) {
      // Uses the same project-scoped service as any independently installed extension.
      await ctx.sessions.query({ limit: 1 });
      return {
        messages: [{ id: "history", role: "assistant", parts: [{ type: "text", text: "Native transcript" }] }],
        controls: [
          {
            id: "model",
            name: "Model",
            type: "selection",
            defaultValue: "small",
            options: [
              { id: "small", name: "Small" },
              { id: "large", name: "Large" },
            ],
          },
        ],
        approval: {
          id: "approval",
          title: "Allow this operation?",
          choices: [{ id: "allow", label: "Allow operation" }],
        },
      };
    },
    async loadDraft(ctx, { draftKey }) {
      const record = await ctx.storage.records.read(ctx.storage.records.id(draftKey));
      return record.exists ? (record.value as unknown as ChatDraft) : { text: "", attachments: [], values: {} };
    },
    async saveDraft(ctx, { draftKey, draft }) {
      await ctx.storage.records.commit({
        operationId: ctx.storage.ids.create(),
        edits: [{ recordId: ctx.storage.records.id(draftKey), replace: JSON.parse(JSON.stringify(draft)) }],
      });
    },
    async onAction(ctx, { action }) {
      if (action.type === "submit")
        return {
          snapshot: {
            messages: [{ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: action.text }] }],
          },
        };
      if (action.type === "approve") return { snapshot: { notice: "Operation approved", approval: null } };
      if (action.type === "upload") {
        const file = await ctx.storage.files.put({
          name: action.name,
          mimeType: action.mediaType,
          data: Uint8Array.from(atob(action.data), (character) => character.charCodeAt(0)),
        });
        return {
          attachment: {
            id: file.id,
            name: file.name,
            size: file.size,
            mediaType: file.mimeType ?? undefined,
            url: file.url,
          },
        };
      }
    },
  },
});
const page = definePage({
  id: "chat",
  title: "Native conversation",
  path: "chat",
  mode: workbenchModes.project,
  main: { kind: "view", view: conversation.ref, cardinality: "one", presentation: "page" },
  slots: [{ id: "side", region: "side", item: { kind: "view", view: conversation.ref, presence: "open" } }],
});
export default defineExtension({ commands: [watch], views: [conversation], pages: [page] });
