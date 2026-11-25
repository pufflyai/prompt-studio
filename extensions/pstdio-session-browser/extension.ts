import {
  accountEvents,
  type ControlValueMap,
  defineExtension,
  defineKeybinding,
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  definePlacement,
  defineView,
  defineViewMenu,
  l10n,
  packageAsset,
  viewDataEvents,
  workbenchModes,
  workbenchPages,
  workbenchResourceKinds,
} from "@pstdio/sdk/extensions";
import { sessionBrowser } from "./refs";
import { act } from "./src/actions";
import { browse, browsePage, search } from "./src/browse";
import { changeHeads, readChange } from "./src/changes";
import { connectionRefresh } from "./src/controls";
import { copySessionId } from "./src/copy-session-id";
import { copySessionNickname } from "./src/copy-session-nickname";
import { acknowledgeSavedDraft } from "./src/draft-recovery";
import { listSessionLinks } from "./src/linked-resources";
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
import { quotaAvailability } from "./src/quota-availability";
import { quotaRestart, quotaRestartHook } from "./src/quota-restart";
import { sessionId } from "./src/resource";
import { pinSession, sessionPinsChanged, sessionPinsIndex } from "./src/session-pins";
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
    browserDraft: {
      acknowledgeRecovery: async (ctx, { renderer, draftKey, draft, draftClientId }) => {
        const id = sessionId(renderer.resource);
        if (id) await acknowledgeNativeInputs(ctx, id, draft, draftClientId);
        await acknowledgeSavedDraft(ctx, draftKey, draft);
      },
    },
    initial: {
      messages: [],
      nativeLinks: true,
      operations: [connectionRefresh],
      nativeHarnessAccount: { controlId: "harness" },
      controls: composerControls,
    },
    refreshEvents: [viewDataEvents.sessionsChanged, viewDataEvents.workspacesChanged, accountEvents.changed],
    query: (ctx, { renderer, values }) => readSnapshot(ctx, renderer.resource, values as ControlValueMap | undefined),
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
    refreshEvents: [viewDataEvents.sessionsChanged, sessionPinsChanged],
    body: browse,
    page: browsePage,
  },
});
const links = defineView({
  id: "linked-resources",
  title: l10n("links.related", "Related resources"),
  icon: "link",
  body: {
    kind: "tree",
    body: listSessionLinks,
    defaultExpandedSectionIds: ["tickets", "sessions", "workspaces", "related"],
    refreshEvents: [
      viewDataEvents.resourceAnchorsChanged,
      viewDataEvents.resourcesChanged,
      viewDataEvents.sessionsChanged,
      viewDataEvents.workspacesChanged,
    ],
  },
});
export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  storageIndexes: [nativeSubmissionIndex, sessionPinsIndex],
  hooks: [quotaRestartHook],
  commands: [
    changeHeads,
    readChange,
    quotaRestart,
    quotaAvailability,
    pinSession,
    create,
    newInViewer,
    open,
    copySessionId,
    copySessionNickname,
    rename,
    archive,
    remove,
    fork,
    stop,
    switchConversation,
    resolve,
    watch,
  ],
  views: [conversation, list, links],
  pages: [sessions, compose, session, draft],
  placements: [viewer],
  viewMenus: [defineViewMenu({ id: "session.resources", owner: conversation.ref, view: links.ref, side: "right" })],
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
      id: "legacy-sessions",
      owner: workbenchPages.sessions,
      view: list.ref,
      resourceScope: "project",
    }),
  ],
  commandPaletteResources: [search],
  resourcePresentations: [
    {
      resourceKind: workbenchResourceKinds.session,
      resolve: resolve.ref,
      refreshEvents: [viewDataEvents.sessionsChanged],
    },
  ],
  keybindings: [
    defineKeybinding({
      id: "new-in-viewer",
      layer: "current",
      key: "N",
      targetScope: "panel",
      when: { resourceType: [workbenchResourceKinds.session, draftKind], view: conversation.ref },
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
