import {
  defineExtension,
  defineKeybinding,
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  definePlacement,
  defineView,
  l10n,
  packageAsset,
  viewDataEvents,
  workbenchModes,
  workbenchPages,
  workbenchResourceKinds,
  workspacePages,
} from "@pstdio/sdk/extensions";
import { sessionBrowser } from "./refs";
import { act } from "./src/actions";
import { browse, browsePage, search } from "./src/browse";
import { connectionRefresh } from "./src/controls";
import { readDraft, saveDraft } from "./src/drafts";
import { acknowledgeNativeInputs } from "./src/native-recovery";
import { nativeSubmissionIndex } from "./src/native-submission";
import {
  archive,
  create,
  fork,
  newInViewer,
  open,
  remove,
  rename,
  resolve,
  stop,
  switchConversation,
} from "./src/navigation";
import { sessionId } from "./src/resource";
import { composerControls, readSnapshot } from "./src/snapshot";
import { conversationTab } from "./src/tab";
import { watch } from "./src/watch";

const draftKind = { kind: "resource-kind" as const, extensionId: "pstdio", id: "session-draft" };
const conversation = defineView({
  id: "conversation",
  title: l10n("conversation.title", "Session"),
  icon: "message-circle",
  body: {
    kind: "chat",
    draftKey: "draft",
    legacySessionDraft: true,
    initial: {
      messages: [],
      nativeLinks: true,
      operations: [connectionRefresh],
      nativeHarnessAccount: { controlId: "harness" },
      controls: composerControls,
    },
    refreshEvents: [viewDataEvents.sessionsChanged, viewDataEvents.workspacesChanged],
    query: (ctx, { renderer }) => readSnapshot(ctx, renderer.resource),
    loadDraft: (ctx, { draftKey }) => readDraft(ctx, draftKey),
    saveDraft: async (ctx, { renderer, draftKey, draft }) => {
      await saveDraft(ctx, draftKey, draft);
      const id = sessionId(renderer.resource);
      if (id) await acknowledgeNativeInputs(ctx, id, draft);
    },
    stream: watch.ref,
    onAction: act,
  },
});
const viewer = definePlacement({
  id: "conversation",
  mode: workbenchModes.project,
  region: "side",
  tab: conversationTab,
  item: {
    kind: "binding",
    binding: {
      kinds: [workbenchResourceKinds.session, draftKind],
      view: conversation.ref,
      cardinality: "many",
      add: { kind: "command", target: { command: create.ref, params: { side: true } } },
    },
  },
});
const compose = definePage({
  id: "compose",
  title: l10n("commands.new", "New session"),
  icon: "message-circle",
  path: "conversations/compose",
  mode: workbenchModes.project,
  parent: sessionBrowser.pages.sessions,
  main: { kind: "view", view: conversation.ref, cardinality: "one", presentation: "page", tab: conversationTab },
  slots: [],
});
const sessions = definePage({
  id: "browse",
  title: l10n("sessions.title", "Sessions"),
  icon: "messages-circle",
  path: "conversations",
  mode: workbenchModes.project,
  main: { kind: "group", default: compose.ref },
  slots: [],
});
const session = definePage({
  id: "conversation",
  title: l10n("conversation.title", "Session"),
  icon: "message-circle",
  path: "conversation",
  mode: workbenchModes.project,
  parent: sessions.ref,
  resource: { kinds: [workbenchResourceKinds.session] },
  main: { kind: "view", view: conversation.ref, cardinality: "one", presentation: "page", tab: conversationTab },
  panelView: viewer.ref,
  slots: [],
});
const draft = definePage({
  id: "draft",
  title: l10n("commands.new", "New session"),
  icon: "message-circle",
  path: "conversations/new",
  mode: workbenchModes.project,
  parent: sessions.ref,
  resource: { kinds: [draftKind] },
  main: { kind: "view", view: conversation.ref, cardinality: "one", presentation: "page", tab: conversationTab },
  panelView: viewer.ref,
  slots: [],
});
const list = defineView({
  id: "list",
  title: l10n("sessions.title", "Sessions"),
  icon: "messages-circle",
  body: {
    kind: "tree",
    searchable: true,
    searchPlaceholder: l10n("sessions.search", "Search sessions"),
    defaultExpandedNodeIds: ["workspace-sessions"],
    structure: [{ id: "sessions", label: l10n("sessions.title", "Sessions"), collapsible: false }],
    refreshEvents: [viewDataEvents.sessionsChanged],
    body: browse,
    page: browsePage,
  },
});
export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  storageIndexes: [nativeSubmissionIndex],
  commands: [create, newInViewer, open, rename, archive, remove, fork, stop, switchConversation, resolve, watch],
  views: [conversation, list],
  pages: [sessions, compose, session, draft],
  placements: [viewer],
  navigationItems: [
    defineNavigationItem({
      id: "sessions",
      owner: workbenchModes.project,
      label: l10n("sessions.title", "Sessions"),
      icon: "messages-circle",
      action: { kind: "page", page: sessions.ref },
    }),
  ],
  navigationTrees: [
    defineNavigationTree({ id: "sessions", owner: sessions.ref, view: list.ref, resourceScope: "project" }),
    defineNavigationTree({
      id: "workspace-sessions",
      owner: workspacePages.workspace,
      optionalOwner: true,
      view: list.ref,
    }),
    defineNavigationTree({ id: "legacy-workspace-sessions", owner: workbenchPages.workspace, view: list.ref }),
    defineNavigationTree({
      id: "legacy-sessions",
      owner: workbenchPages.sessions,
      view: list.ref,
      resourceScope: "project",
    }),
  ],
  commandPaletteResources: [search],
  keybindings: [
    defineKeybinding({
      id: "new-in-viewer",
      layer: "current",
      key: "N",
      targetScope: "panel",
      when: { resourceType: [workbenchResourceKinds.session, draftKind] },
      action: { kind: "command", target: { command: newInViewer.ref } },
    }),
    defineKeybinding({
      id: "new-session",
      layer: "create",
      key: "S",
      action: { kind: "command", target: { command: create.ref, params: {} } },
    }),
    defineKeybinding({
      id: "go-sessions",
      layer: "go",
      key: "S",
      sticky: true,
      action: { kind: "page", page: sessions.ref },
    }),
  ],
});
