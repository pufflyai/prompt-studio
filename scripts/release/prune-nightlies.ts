import { $ } from "bun";

type Release = { tagName: string; isDraft: boolean; isPrerelease: boolean };

const isNightlyTag = (tagName: string) => /^pstdio@\d+\.\d+\.\d+-nightly\.\d+$/.test(tagName);

// Only one nightly exists at a time: the one this run just published. Runs never
// overlap, so every other nightly is older, even if a reverted bump gave it a higher
// version. The new nightly is published only after its desktop assets were verified,
// so the nightly channel always has a complete build to update to.
export const nightliesToPrune = (releases: Release[], tags: string[], currentTag: string) => {
  const current = releases.find((release) => release.tagName === currentTag);
  if (!current || current.isDraft || !current.isPrerelease || !isNightlyTag(currentTag)) {
    throw new Error(`${currentTag} is not a published nightly release`);
  }
  const prunedReleases = releases
    .filter((release) => release.isPrerelease && isNightlyTag(release.tagName) && release.tagName !== currentTag)
    .map((release) => release.tagName);
  const releaseTags = new Set(releases.map((release) => release.tagName));
  // A run that failed after pushing its tag but before creating its release leaves the tag behind.
  const orphanTags = tags.filter((tag) => isNightlyTag(tag) && tag !== currentTag && !releaseTags.has(tag));
  return { releases: prunedReleases, tags: orphanTags };
};

if (import.meta.main) {
  const [currentTag] = process.argv.slice(2);
  if (!currentTag) throw new Error("usage: prune-nightlies.ts <current nightly tag>");
  const releases = (await $`gh release list --limit 100 --json tagName,isDraft,isPrerelease`.json()) as Release[];
  const tags = (await $`git ls-remote --tags --refs origin ${"refs/tags/pstdio@*-nightly.*"}`.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("refs/tags/")[1]!);
  const pruned = nightliesToPrune(releases, tags, currentTag);
  for (const tag of pruned.releases) {
    console.log(`Deleting nightly ${tag} and its tag`);
    await $`gh release delete ${tag} --cleanup-tag --yes`;
  }
  for (const tag of pruned.tags) {
    console.log(`Deleting orphan nightly tag ${tag}`);
    await $`git push origin --delete ${`refs/tags/${tag}`}`;
  }
}
