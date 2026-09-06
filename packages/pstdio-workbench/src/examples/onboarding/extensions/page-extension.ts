import { defineExtension, defineNavigationItem, definePage, defineView, workbenchModes } from "@pstdio/sdk/extensions";

const topics = [
  {
    id: "guide",
    title: "Getting started",
    content: "Welcome to your first extension. Choose Pages or Views in the sidebar to keep reading.",
  },
  {
    id: "pages",
    title: "Pages",
    content: "A page owns the main content and its panels. Opening another page replaces the current page's content.",
  },
  {
    id: "views",
    title: "Views",
    content:
      "A view defines reusable content. This guide uses native file views, so the host renders the Markdown for you.",
  },
];
const views = topics.map((topic) =>
  defineView({
    id: topic.id,
    title: topic.title,
    body: {
      kind: "file",
      load: async () => ({ fileName: `${topic.id}.md`, content: `# ${topic.title}\n\n${topic.content}` }),
    },
  }),
);
const pages = views.map((view) =>
  definePage({
    id: view.id,
    title: view.title,
    path: view.id,
    mode: workbenchModes.project,
    main: { kind: "view", view: view.ref, cardinality: "one" },
    slots: [],
  }),
);
export const guidePage = pages[0]!;
const navigationItems = pages.map((page) =>
  defineNavigationItem({
    id: page.id,
    owner: workbenchModes.project,
    slot: "content",
    group: "Learn",
    label: page.title,
    icon: "BookOpen",
    action: { kind: "page", page: page.ref },
  }),
);

export default defineExtension({ views, pages, navigationItems });
