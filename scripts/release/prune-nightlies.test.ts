import { describe, expect, test } from "bun:test";
import { nightliesToPrune } from "./prune-nightlies";

const release = (tagName: string, options: { isDraft?: boolean; isPrerelease?: boolean } = {}) => ({
  tagName,
  isDraft: options.isDraft ?? false,
  isPrerelease: options.isPrerelease ?? tagName.includes("-"),
});

const current = "pstdio@0.43.0-nightly.20261012030000";
const older = "pstdio@0.43.0-nightly.20261011030000";

describe("nightly pruning", () => {
  test("deletes older nightlies, including failed drafts, and never a stable release or another prerelease", () => {
    const releases = [
      release(current),
      release(older),
      release("pstdio@0.43.0-nightly.20261010030000", { isDraft: true }),
      release("pstdio@0.42.3"),
      release("pstdio@0.42.4", { isDraft: true }),
      release("pstdio@0.43.0-rc.1"),
      release("@pstdio/sdk@0.43.0-nightly.20261011030000"),
    ];
    expect(nightliesToPrune(releases, [], current).releases).toEqual([older, "pstdio@0.43.0-nightly.20261010030000"]);
  });

  test("keeps only the nightly just published, even when a reverted bump gives it a lower version", () => {
    const lowerCurrent = "pstdio@0.42.4-nightly.20261013030000";
    expect(nightliesToPrune([release(lowerCurrent), release(current)], [], lowerCurrent).releases).toEqual([current]);
  });

  test("deletes nightly tags a failed run left without a release", () => {
    const orphan = "pstdio@0.43.0-nightly.20261009030000";
    const tags = [current, older, orphan, "pstdio@0.42.3", "pstdio@0.43.0-rc.1"];
    expect(nightliesToPrune([release(current), release(older)], tags, current).tags).toEqual([orphan]);
  });

  test("refuses to prune until the new nightly is published", () => {
    expect(() => nightliesToPrune([release(current, { isDraft: true }), release(older)], [], current)).toThrow(
      `${current} is not a published nightly release`,
    );
    expect(() => nightliesToPrune([release(older)], [], current)).toThrow(
      `${current} is not a published nightly release`,
    );
    expect(() => nightliesToPrune([release("pstdio@0.42.3")], [], "pstdio@0.42.3")).toThrow(
      "pstdio@0.42.3 is not a published nightly release",
    );
  });
});
