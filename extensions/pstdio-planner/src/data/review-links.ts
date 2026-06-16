import type { ReviewLinkKind, ReviewLinkProvider } from "./types";

interface ReviewLinkTarget {
  provider: ReviewLinkProvider;
  kind: ReviewLinkKind;
  externalId: string | null;
}

const unknownReviewLinkTarget = (): ReviewLinkTarget => ({
  provider: "unknown",
  kind: "review",
  externalId: null,
});

const githubPullRequestTarget = (path: string) => {
  const match = /\/pull\/(\d+)(?:\/|$)/.exec(path);
  if (!match) return null;
  return { provider: "github", kind: "pull_request", externalId: match[1] } satisfies ReviewLinkTarget;
};

const gitlabMergeRequestTarget = (path: string) => {
  const match = /\/-\/merge_requests\/(\d+)(?:\/|$)/.exec(path);
  if (!match) return null;
  return { provider: "gitlab", kind: "merge_request", externalId: match[1] } satisfies ReviewLinkTarget;
};

export const inferReviewLinkTarget = (url: string) => {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "github.com") return githubPullRequestTarget(parsed.pathname) ?? unknownReviewLinkTarget();
  return gitlabMergeRequestTarget(parsed.pathname) ?? unknownReviewLinkTarget();
};
