import { describe, expect, test } from "bun:test";
import { selectReleasePackages, toReleaseTagRefs } from "./push-release-tags";

describe("release tags", () => {
  test("excludes ignored repo-local packages from pushed tags and releases", () => {
    const publishedPackages = [
      { name: "font-editor", version: "0.1.1" },
      { name: "pstdio", version: "0.26.1" },
      { name: "pstdio-planner-loops", version: "0.1.0" },
    ];

    const releasePackages = selectReleasePackages(publishedPackages, new Set(["font-editor", "pstdio-planner-loops"]));

    expect(releasePackages).toEqual([{ name: "pstdio", version: "0.26.1" }]);
    expect(toReleaseTagRefs(releasePackages)).toEqual(["refs/tags/pstdio@0.26.1"]);
  });
});
