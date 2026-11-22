import {
  defineCommand,
  defineNavigationItem,
  definePage,
  definePlacement,
  defineResourceKind,
  defineView,
  defineViewMenu,
  packageAsset,
  params,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { letterPage, letterResource, mailboxPage } from "./panel-view-contracts";

export const addLetterViewer = defineCommand({
  id: "add-letter-viewer",
  title: "New letter viewer",
  run(ctx) {
    ctx.navigation.open({
      kind: "panel",
      panel: { kind: "placement", id: "letter-reader" },
      resource: letterResource(`draft-${crypto.randomUUID()}`, ctx.projectId),
      open: "pin",
    });
  },
});
export const completeLetter = defineCommand({
  id: "complete-letter",
  title: "Save letter",
  params: { delay: params.number() },
  async run(ctx, params) {
    if (params.delay) await new Promise((resolve) => setTimeout(resolve, params.delay));
    const resource = letterResource(`saved-${crypto.randomUUID()}`, ctx.projectId);
    await ctx.storage.collection("panel-view-letters").put(resource.id, resource);
    ctx.navigation.open({
      kind: "viewer",
      operation: "replace",
      from: ctx.resource,
      resource,
      ...(!ctx.resource ? { page: letterPage } : {}),
    });
    return resource;
  },
});
export const deleteLetter = defineCommand({
  id: "delete-letter",
  title: "Delete letter",
  async run(ctx) {
    if (!ctx.resource) return;
    await ctx.storage.collection("panel-view-letters").delete(ctx.resource.id);
    await ctx.resources.removed(ctx.resource);
  },
});
export const headerContext = defineCommand({
  id: "header-context",
  title: "Read header context",
  run: (ctx) => ctx.resource?.id ?? "landing",
});

export const createPanelViewFixture = (baseUrl: string) => {
  const toolbar = defineView({
    id: "letter-toolbar",
    title: "Letter toolbar",
    body: { kind: "webview", entry: packageAsset("./letter-toolbar.tsx", baseUrl), capabilities: ["commands.execute"] },
  });
  const reader = defineView({
    id: "letter-reader",
    title: "Letter viewer",
    header: { view: toolbar.ref },
    icon: "Mail",
    body: {
      kind: "webview",
      entry: packageAsset("./letter-reader.tsx", baseUrl),
      capabilities: ["commands.execute", "navigation.open"],
    },
  });
  const browser = defineView({
    id: "letter-browser",
    title: "Letter browser",
    icon: "Inbox",
    body: {
      kind: "webview",
      entry: packageAsset("./letter-browser.tsx", baseUrl),
      capabilities: ["navigation.open"],
    },
  });
  const activity = defineView({
    id: "letter-activity",
    title: "Letter activity",
    icon: "Activity",
    body: { kind: "webview", entry: packageAsset("./letter-browser.tsx", baseUrl), capabilities: ["navigation.open"] },
  });
  const kind = defineResourceKind({ id: "letter", label: "Letter", icon: "Mail" });
  const viewer = definePlacement({
    id: "letter-reader",
    mode: workbenchModes.project,
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [kind.ref],
        cardinality: "many",
        view: reader.ref,
        add: { kind: "command", target: { command: addLetterViewer.ref } },
      },
    },
    tab: { query: (_ctx, input) => ({ label: input.renderer.resource?.label ?? "New letter" }) },
  });
  const browserPanel = definePlacement({
    id: "letter-browser",
    mode: workbenchModes.project,
    region: "secondary",
    item: { kind: "view", view: browser.ref, presence: "closed" },
  });
  const mailbox = definePage({
    id: mailboxPage.id,
    title: "Mailbox",
    path: "mailbox",
    mode: workbenchModes.project,
    main: {
      kind: "view",
      presentation: "page",
      view: reader.ref,
      cardinality: "one",
      tab: {
        query: () => ({
          label: "New letter",
          menu: [
            {
              id: "letters",
              rows: [
                {
                  id: "a",
                  label: "Switch to A",
                  action: { kind: "viewer", operation: "switch", page: letterPage, resource: letterResource("A") },
                },
              ],
            },
          ],
        }),
      },
    },
    panelView: viewer.ref,
    slots: [],
  });
  const letter = definePage({
    id: letterPage.id,
    title: "Letter",
    path: "letters",
    mode: workbenchModes.project,
    parent: mailbox.ref,
    resource: { kinds: [kind.ref] },
    panelView: viewer.ref,
    main: { kind: "view", presentation: "page", view: reader.ref, cardinality: "many" },
    slots: [],
  });
  const collection = definePage({
    id: "collection",
    title: "Letter collection",
    path: "collection",
    mode: workbenchModes.project,
    main: { kind: "view", view: browser.ref, cardinality: "one" },
    slots: [],
  });
  return {
    commands: [addLetterViewer, completeLetter, deleteLetter, headerContext],
    resourceKinds: [kind],
    views: [reader, browser, toolbar, activity],
    viewMenus: [
      defineViewMenu({ id: "letter-tools", owner: reader.ref, view: browser.ref, side: "right" }),
      defineViewMenu({ id: "letter-activity", owner: reader.ref, view: activity.ref, side: "bottom" }),
    ],
    placements: [viewer, browserPanel],
    pages: [mailbox, letter, collection],
    navigationItems: [
      defineNavigationItem({
        id: "mailbox",
        owner: workbenchModes.project,
        label: "Mailbox",
        icon: "Mail",
        action: { kind: "page", page: mailbox.ref, intent: "restore" },
      }),
    ],
  };
};
