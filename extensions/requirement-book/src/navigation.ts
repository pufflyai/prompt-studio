import {
  defineCommand,
  defineCommandPaletteResource,
  defineNavigationTree,
  definePage,
  defineResourceKind,
  defineView,
  l10n,
  packageAsset,
  params,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { bookMenu } from "./book-menu";
import { readBook } from "./read";
import { changed } from "./records";

export const requirement = defineResourceKind({
  id: "requirement",
  label: l10n("book.requirement", "Requirement"),
  icon: "book-open",
  resolve: { kind: "command", id: "resolve" },
});
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
    form: { type: "string", default: "", values: ["", "rule", "chapter", "finding", "observation"] },
  },
  main: { kind: "view", view: view.ref, cardinality: "one", presentation: "page", tab: bookMenu },
  slots: [],
});
export const rulePage = definePage({
  id: "requirement",
  title: l10n("book.requirement", "Requirement"),
  path: "requirement",
  mode: workbenchModes.project,
  parent: page.ref,
  resource: { kinds: [requirement.ref] },
  main: { kind: "view", view: view.ref, cardinality: "one", presentation: "page", tab: bookMenu },
  slots: [],
});
export const ruleTarget = (ref: string, title: string, projectId: string) => ({
  kind: "page" as const,
  page: rulePage.ref,
  resource: { type: requirement.id, id: ref, label: title, extensionId: "pstdio.requirement-book", projectId },
});
export const openCommand = defineCommand({
  id: "open",
  title: l10n("book.open", "Open requirement book"),
  cli: true,
  params: { reference: params.text() },
  async run(ctx, input) {
    if (input.reference) {
      const data = await readBook(ctx);
      const rule = data.rules.find((item) => item.ref === input.reference);
      if (!rule) throw new Error("Requirement not found.");
      ctx.navigation.open(ruleTarget(rule.ref, rule.title, ctx.projectId));
    } else ctx.navigation.open({ kind: "page", page: page.ref });
    return { opened: true };
  },
});
export const resolveCommand = defineCommand({
  id: "resolve",
  title: "Resolve a requirement",
  params: { reference: params.text({ resolvedFrom: "resource" }) },
  async run(ctx, input) {
    const data = await readBook(ctx);
    const rule = data.rules.find((item) => item.ref === (input.reference ?? ctx.resource?.id));
    return rule
      ? {
          type: requirement.id,
          id: rule.ref,
          label: rule.title,
          projectId: ctx.projectId,
          extensionId: ctx.extensionId,
        }
      : null;
  },
});
export const resources = defineCommandPaletteResource({
  id: "requirements",
  title: l10n("book.search", "Search requirements"),
  resourceKind: requirement.ref,
  refreshEvents: [changed],
  async query(ctx, input) {
    const data = await readBook(ctx, { query: input.query });
    return {
      items: data.rules.slice(0, input.limit).map((rule) => ({
        id: rule.ref,
        label: `${rule.ref} ${rule.title}`,
        icon: "book-open",
        target: ruleTarget(rule.ref, rule.title, ctx.projectId),
      })),
    };
  },
});
export const navigationView = defineView({
  id: "chapters",
  title: l10n("book.title", "Requirement book"),
  body: {
    kind: "tree",
    refreshEvents: [changed],
    async body(ctx) {
      let data: Awaited<ReturnType<typeof readBook>>;
      try {
        data = await readBook(ctx);
      } catch {
        return [];
      }
      return [
        {
          id: "review",
          collapsible: false,
          nodes: ["Findings", "Undocumented", "Suggestions"].map((section) => ({
            id: section,
            label: `${section}${data.counts[section as keyof typeof data.counts] ? ` · ${data.counts[section as keyof typeof data.counts]}` : ""}`,
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
              label: `RB${chapter.id} ${chapter.title}`,
              target: { kind: "page" as const, page: page.ref, params: { chapter: chapter.id, review: "" } },
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
