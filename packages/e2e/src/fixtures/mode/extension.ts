import {
  type ChatDraft,
  defineExtension,
  defineMode,
  definePage,
  definePlacement,
  defineStatusBarItem,
  defineView,
  packageAsset,
  workbenchSlots,
} from "@pstdio/sdk/extensions";

const mode = defineMode({
  id: "isolated",
  label: "Isolated mode",
  regions: ["main", "side"],
  chrome: { sidenav: false },
});
const view = defineView({
  id: "content",
  title: "Mode content",
  body: { kind: "webview", entry: packageAsset("./view.ts", import.meta.url) },
});
const status = defineView({
  id: "status",
  title: "Mode status",
  body: { kind: "webview", entry: packageAsset("./view.ts", import.meta.url) },
});
const chat = defineView({
  id: "chat",
  title: "Mode chat",
  body: {
    kind: "chat",
    draftKey: "mode-draft",
    query: () => ({ messages: [] }),
    onAction: () => {},
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
  },
});
const page = definePage({
  id: "mode",
  path: "mode",
  title: "Mode page",
  mode: mode.ref,
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [],
});
export default defineExtension({
  modes: [mode],
  views: [view, status, chat],
  pages: [page],
  placements: [
    definePlacement({
      id: "chat",
      mode: mode.ref,
      region: "side",
      item: { kind: "view", view: chat.ref, presence: "open" },
    }),
  ],
  statusBarItems: [
    defineStatusBarItem({
      id: "status",
      view: status.ref,
      slot: workbenchSlots.statusBarLeading,
      when: { mode: mode.ref },
    }),
  ],
});
