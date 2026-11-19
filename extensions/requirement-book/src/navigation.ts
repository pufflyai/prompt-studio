import {
  defineCommand,
  defineNavigationTree,
  definePage,
  defineView,
  l10n,
  packageAsset,
  params,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { bookMenu } from "./book-menu";
import { readIndex } from "./read-index";
import { changed } from "./records";
import { resourceTarget, ruleTarget } from "./targets";

export const view = defineView({
  id: "book",
  title: l10n("book.title", "Requirement book"),
  body: {
    kind: "webview",
    entry: packageAsset("./view.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open", "page.params.update", "clipboard.write"],
  },
});
export const page = definePage({
  id: "book",
  title: l10n("book.title", "Requirement book"),
  icon: "book-open",
  path: "book",
  mode: workbenchModes.project,
  params: {
    chapter: { type: "number", default: 1 },
    review: { type: "string", default: "" },
    form: { type: "string", default: "", values: ["", "rule", "chapter", "finding"] },
  },
  main: { kind: "view", view: view.ref, cardinality: "one", presentation: "page", tab: bookMenu },
  slots: [],
});
export const openCommand = defineCommand({
  id: "open",
  title: l10n("book.open", "Open requirement book"),
  cli: true,
  params: { reference: params.text() },
  async run(ctx, input) {
    if (input.reference) {
      const data = await readIndex(ctx);
      const rule = data.rules.find((item) => item.ref === input.reference);
      if (!rule) throw new Error("Requirement not found.");
      ctx.navigation.open(
        ruleTarget(rule.ref, rule.title, ctx.projectId, data.chapters.find((chapter) => chapter.id === rule.chapter)!),
      );
    } else ctx.navigation.open({ kind: "page", page: page.ref });
    return { opened: true };
  },
});
export const navigationView = defineView({
  id: "chapters",
  title: l10n("book.title", "Requirement book"),
  body: {
    kind: "tree",
    refreshEvents: [changed],
    async body(ctx) {
      let data: Awaited<ReturnType<typeof readIndex>>;
      try {
        data = await readIndex(ctx);
      } catch {
        return [];
      }
      return [
        {
          id: "review",
          collapsible: false,
          nodes: ["Findings", "Suggestions"].map((section) => ({
            id: section,
            label: section,
            badge: data.counts[section as keyof typeof data.counts]
              ? { label: String(data.counts[section as keyof typeof data.counts]) }
              : undefined,
            target: { kind: "page" as const, page: page.ref, params: { review: section } },
          })),
        },
        ...["Core", "Extensions"].map((group) => ({
          id: group,
          label: group,
          collapsible: false,
          nodes: data.chapters
            .filter((chapter) => chapter.group === group)
            .map((chapter) => ({
              id: `chapter-${chapter.id}`,
              label: chapter.title,
              icon: "library",
              target: resourceTarget("chapter", String(chapter.id), chapter.title, ctx.projectId),
            })),
        })),
      ];
    },
  },
});
export const navigationTree = defineNavigationTree({
  id: "chapters",
  owner: page.ref,
  slot: "content",
  view: navigationView.ref,
  resourceScope: "project",
});
