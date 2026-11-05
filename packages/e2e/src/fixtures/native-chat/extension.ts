import {
  type ChatDraft,
  type ChatRendererEvent,
  type ChatRendererSnapshot,
  defineCommand,
  defineExtension,
  definePage,
  defineView,
  streamOf,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const fixtureHarnessId = "pstdio.workbench-fixture.harness.fake";
const initial: ChatRendererSnapshot = { messages: [], values: {}, controls: [] };
const watch = defineCommand({
  id: "watch",
  title: "Watch conversation",
  stream: streamOf<ChatRendererEvent>(),
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
        operations: [
          { id: "ask", label: "Ask a question" },
          { id: "queue", label: "Show saved queue" },
        ],
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
    async resolveLink(_ctx, { candidate }) {
      return candidate.source === "./provider.md" ? { href: "/provider-document", label: "Provider document" } : null;
    },
    async resolveImage(_ctx, { source }) {
      return source === "./provider.png"
        ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII="
        : null;
    },
    async onAction(ctx, { action }) {
      if (action.type === "operation" && action.id === "queue")
        return {
          snapshot: {
            nativeHarnessAccount: { controlId: "provider" },
            controls: [
              {
                id: "provider",
                name: "Provider",
                type: "harness",
                defaultValue: { harnessId: fixtureHarnessId },
                lockIdentity: true,
                preserveSettings: true,
                settingsMode: "resolved",
              },
            ],
            values: { provider: { harnessId: fixtureHarnessId, model: "A", params: { thinking: "A" } } },
            queuedFollowUps: [
              {
                id: "queue-item",
                prompt: "Saved queued prompt",
                revision: "saved-revision",
                model: "B",
                params: { thinking: "B" },
                values: { provider: { harnessId: fixtureHarnessId, model: "B", params: { thinking: "B" } } },
              },
            ],
            messages: [
              {
                id: "provider-links",
                role: "assistant",
                parts: [
                  { type: "text", text: "[Provider document](./provider.md)\n\n![Provider image](./provider.png)" },
                ],
              },
            ],
          },
        };
      if (action.type === "openLink") return { snapshot: { notice: "Provider link opened" } };
      if (action.type === "queue") {
        const settings = action.values.provider;
        if (
          !settings ||
          typeof settings !== "object" ||
          Array.isArray(settings) ||
          !("harnessId" in settings) ||
          settings.model !== "B" ||
          settings.params?.thinking !== "B"
        )
          throw new Error("Queued request settings were replaced by the active conversation.");
        if (action.item.revision !== "saved-revision") throw new Error("The selected queue revision was lost.");
        return { snapshot: { notice: `Queue ${action.operation} kept B`, queuedFollowUps: [] } };
      }
      if (action.type === "operation" && action.id === "ask")
        return {
          snapshot: {
            messages: [
              {
                id: "question",
                role: "assistant",
                parts: [
                  {
                    type: "tool",
                    tool: "question",
                    callId: "question",
                    status: "pending",
                    state: {
                      input: { questions: [{ question: "Which validation?", options: ["Browser", "Native"] }] },
                    },
                  },
                ],
              },
            ],
          },
        };
      if (action.type === "submit" && action.questionResponse) {
        if (action.attachments.length) throw new Error("Question replies must not send draft files.");
        return { snapshot: { messages: [], notice: "Question answered" } };
      }
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
