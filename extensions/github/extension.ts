import {
  defineCommandPaletteResource,
  defineExtension,
  definePage,
  defineResourceKind,
  defineView,
  l10n,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { findMergedPrs, importPr, readPrs, resolvePrs } from "./src/commands";
import { pullRequestsChanged } from "./src/events";
import { type PullRequestIdentity, parsePullRequest, pullRequestResource } from "./src/pull-requests";

const pullRequest = defineResourceKind({
  id: "pull-request",
  label: l10n("resource.pullRequest", "Pull request"),
  icon: "git-pull-request",
  resolveMany: resolvePrs.ref,
});
const detail = defineView({
  id: "pull-request",
  title: l10n("view.pullRequest", "Pull request"),
  body: {
    kind: "file",
    async load(_ctx, { renderer }) {
      const pr = parsePullRequest(renderer.resource?.id ?? "");
      if (!pr) return { emptyState: { title: "Pull request unavailable" } };
      return {
        fileName: "pull-request.md",
        mimeType: "text/markdown",
        editable: false,
        content: `# ${pr.repository} #${pr.number}\n\n[Open pull request on ${pr.host}](${pr.id})`,
      };
    },
  },
});
const home = definePage({
  id: "github",
  title: "GitHub",
  path: "github",
  mode: workbenchModes.project,
  main: { kind: "view", view: detail.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
const page = definePage({
  id: "pull-request",
  title: l10n("page.pullRequest", "Pull request"),
  path: "pull-request",
  parent: home.ref,
  mode: workbenchModes.project,
  resource: { kinds: [pullRequest.ref] },
  main: { kind: "view", view: detail.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
const discovery = defineCommandPaletteResource({
  id: "pull-requests",
  title: l10n("search.pullRequests", "GitHub pull requests"),
  resourceKind: pullRequest.ref,
  refreshEvents: [pullRequestsChanged],
  async query(ctx, input) {
    const query = input.query?.trim() ?? "";
    const url = parsePullRequest(query);
    const saved = await ctx.storage.collection<PullRequestIdentity>("pull-requests").list();
    const prs = url
      ? [url]
      : saved.filter((pr) => `${pr.repository} #${pr.number}`.toLowerCase().includes(query.toLowerCase()));
    return {
      items: prs.slice(0, input.limit ?? 50).map((pr) => ({
        id: pr.id,
        label: `${pr.repository} #${pr.number}`,
        icon: "git-pull-request",
        target: { kind: "page" as const, page: page.ref, resource: pullRequestResource(pr, ctx.projectId) },
      })),
    };
  },
});
export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  commands: [findMergedPrs, importPr, readPrs, resolvePrs],
  resourceKinds: [pullRequest],
  views: [detail],
  pages: [home, page],
  commandPaletteResources: [discovery],
});
