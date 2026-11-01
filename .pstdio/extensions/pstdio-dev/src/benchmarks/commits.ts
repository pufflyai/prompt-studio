import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import type { CachedResult, ReleaseRecord } from "./store";

export interface CommitOption {
  sha: string;
  ref: string;
  message: string;
}

const FIELD = "\u001f";

// `git log --first-parent` lists merged pull requests on main, newest first.
export const parseMainLog = (text: string): CommitOption[] =>
  text
    .split("\n")
    .filter(Boolean)
    .map((line, index) => {
      const [sha, message] = line.split(FIELD);
      return { sha, ref: index ? `main~${index}` : "main", message };
    });

// Annotated tags point at a tag object, so the peeled commit wins over the tag's own id.
export const parseReleaseTags = (text: string): CommitOption[] =>
  text
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      const [ref, peeled, object, message] = line.split(FIELD);
      if (!/^pstdio@\d+\.\d+\.\d+$/.test(ref)) return [];
      return [{ sha: peeled || object, ref, message }];
    });

type GitContext = Pick<ExtensionContextBase, "process">;

export const listCommits = async (ctx: GitContext, results: CachedResult[], releases: ReleaseRecord[] = []) => {
  const git = async (args: string[]) => (await ctx.process.runOrThrow({ command: ["git", ...args] })).stdout;
  const main = parseMainLog(await git(["log", "origin/main", "--first-parent", "-n", "30", `--format=%H${FIELD}%s`]));
  const tags = parseReleaseTags(
    await git([
      "for-each-ref",
      "refs/tags/pstdio@*",
      "--sort=-creatordate",
      `--format=%(refname:short)${FIELD}%(*objectname)${FIELD}%(objectname)${FIELD}%(contents:subject)`,
    ]),
  );
  // A local tag can be stale after a tag moved on GitHub, so synced release commits win.
  for (const tag of tags) {
    const synced = releases.find((release) => `pstdio@${release.version}` === tag.ref)?.sha;
    if (synced) tag.sha = synced;
  }
  const known = new Set([...main, ...tags].map((commit) => commit.sha));
  // Runs started from elsewhere can measure branches; keep them pickable once their results exist.
  // Newest first, like the main log, so Compare defaults to the newest commit as head.
  const measured = results
    .filter((result) => !known.has(result.file.commit.sha))
    .sort((a, b) => b.file.finishedAt.localeCompare(a.file.finishedAt))
    .map((result) => ({ sha: result.file.commit.sha, ref: result.file.commit.ref ?? "", message: "" }));
  const unique = new Map([...main, ...tags, ...measured].map((commit) => [commit.sha, commit]));
  return [...unique.values()];
};
