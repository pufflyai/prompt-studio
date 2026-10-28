import {
  defineExtension,
  defineNavigationItem,
  definePage,
  definePlacement,
  defineResourceKind,
  defineStatusBarItem,
  l10n,
  workbenchModes,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import { defineExampleEnvironment, webview } from "../definition";
import { readExampleState } from "../example-state";
import { createScribblePage, scribbleCommands } from "../scribble-commands";
import { scribbleDocumentPage, scribbleDraftKind, scribbleDraftPage } from "../scribble-refs";
import { scribbleTree } from "../scribble-tree";
import { examplesChanged } from "../state-events";

const document = webview("scribble-document", "Document");
const status = webview("scribble-status", "Sync status");
const environment = defineExampleEnvironment({
  name: "scribble",
  label: "Scribble",
  icon: "Feather",
  regions: ["main", "side"],
  chrome: { sidenav: scribbleTree.ref, activity: false },
  regionSettings: {
    main: { alwaysShowTabs: true },
    sidenav: { size: { defaultPx: 240, minPx: 200, maxPx: 320 }, canClose: false },
  },
});
const draftKind = defineResourceKind({
  id: scribbleDraftKind.id,
  label: l10n("resources.scribbleDraft", "Page draft"),
  icon: "file-text",
});
const viewer = definePlacement({
  id: "scribble-document",
  mode: environment.mode.ref,
  region: "main",
  addableIn: ["main"],
  item: {
    kind: "binding",
    binding: {
      kinds: [environment.resourceKind.ref, draftKind.ref],
      view: document.ref,
      cardinality: "many",
      add: { kind: "command", target: { command: createScribblePage.ref } },
    },
  },
  tab: {
    refreshEvents: [examplesChanged],
    query: async (ctx, { renderer }) => {
      if (renderer.resource?.type === scribbleDraftKind.id) return { label: "New page", icon: "file-text" };
      const state = await readExampleState(ctx.storage, "scribble");
      const document = state.documents.find((item) => item.id === renderer.resource?.id);
      return document ? { label: document.title, icon: document.icon } : {};
    },
  },
});
const homePage = definePage({
  id: "scribble",
  title: l10n("pages.scribble", "Scribble"),
  icon: "Feather",
  path: "scribble",
  mode: environment.mode.ref,
  main: { kind: "panels" },
  panelView: viewer.ref,
  slots: [],
});
const page = definePage({
  id: scribbleDocumentPage.id,
  title: l10n("pages.scribbleDocument", "Page"),
  path: "scribble/resource",
  mode: environment.mode.ref,
  parent: homePage.ref,
  resource: { kinds: [environment.resourceKind.ref] },
  main: { kind: "panels", landing: viewer.ref },
  slots: [],
});
const navigation = defineNavigationItem({
  id: "scribble",
  label: l10n("navigation.scribble", "Scribble"),
  icon: "Feather",
  owner: workbenchModes.project,
  group: "Examples",
  slot: "content",
  action: {
    kind: "page",
    page: page.ref,
    resource: { type: "scribble.document", id: "north-star", label: "North star" },
    open: "pin",
  },
});
const draftPage = definePage({
  id: scribbleDraftPage.id,
  title: l10n("pages.scribbleDraft", "New page"),
  path: "scribble/new",
  mode: environment.mode.ref,
  parent: homePage.ref,
  resource: { kinds: [draftKind.ref] },
  main: { kind: "panels", landing: viewer.ref },
  slots: [],
});
export const example = { ...environment, homePage, page, navigation };
export default defineExtension({
  commands: Object.values(scribbleCommands),
  statusBarItems: [
    defineStatusBarItem({
      id: "scribble-sync",
      view: status.ref,
      slot: workbenchSlots.statusBarTrailing,
      when: { mode: environment.mode.ref },
    }),
  ],
  modes: [environment.mode],
  themes: [environment.theme],
  resourceKinds: [environment.resourceKind, draftKind],
  pages: [homePage, page, draftPage],
  views: [document, scribbleTree, status],
  placements: [viewer],
  navigationItems: [navigation],
});
