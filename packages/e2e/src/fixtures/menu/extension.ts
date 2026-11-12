import { defineExtension, definePage, defineView, defineViewMenu, workbenchModes } from "@pstdio/sdk/extensions";

const content = defineView({
  id: "content",
  title: "Menu content",
  body: { kind: "tree", body: async () => [{ id: "content", label: "Content", nodes: [] }] },
});
const menu = defineView({
  id: "menu",
  title: "Attached menu",
  body: { kind: "tree", body: async () => [{ id: "menu", label: "Menu", nodes: [] }] },
});
const page = definePage({
  id: "menu",
  path: "menu",
  title: "Menu page",
  mode: workbenchModes.project,
  main: { kind: "view", view: content.ref, cardinality: "one" },
  slots: [],
});
export default defineExtension({
  views: [content, menu],
  pages: [page],
  viewMenus: [defineViewMenu({ id: "attached", owner: content.ref, view: menu.ref, side: "left" })],
});
