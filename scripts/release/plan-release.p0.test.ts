import { expect, test } from "bun:test";
import { planStableRelease } from "./plan-release";

const head = "b".repeat(40);
const earlier = "a".repeat(40);

const pkg = (name: string, version: string, npmVersions: string[] | null) => ({ name, version, npmVersions });

const unpublished = [
  pkg("pstdio", "0.43.0", ["0.42.0"]),
  pkg("@pstdio/sdk", "0.43.0", ["0.42.0"]),
  pkg("@pstdio/cli-linux-x64", "0.43.0", ["0.42.0"]),
];

const plan = (input: Partial<Parameters<typeof planStableRelease>[0]>) =>
  planStableRelease({
    releaseState: "missing",
    packages: unpublished,
    tagCommit: null,
    patchBaseTag: null,
    headCommit: head,
    mainCommit: head,
    ...input,
  });

test("does nothing once the GitHub release is published", () => {
  expect(plan({ releaseState: "published", tagCommit: head })).toEqual({ release: false });
});

test("releases the pushed commit and creates its tag", () => {
  expect(plan({})).toEqual({ release: true, commit: head, placeTag: true, problems: [] });
});

test("moves the tag of an unpublished release to the pushed commit", () => {
  expect(plan({ releaseState: "draft", tagCommit: earlier })).toEqual({
    release: true,
    commit: head,
    placeTag: true,
    problems: [],
  });
});

test("keeps a tag that already points at the pushed commit", () => {
  expect(plan({ tagCommit: head })).toEqual({ release: true, commit: head, placeTag: false, problems: [] });
});

test("leaves an unpublished release to the newest commit on main", () => {
  expect(plan({ headCommit: earlier, tagCommit: head })).toEqual({ release: false });
});

test("finishes a partly published release from the commit that started it", () => {
  const partlyPublished = [pkg("pstdio", "0.43.0", ["0.42.0", "0.43.0"]), pkg("@pstdio/sdk", "0.43.0", ["0.42.0"])];
  expect(plan({ releaseState: "draft", packages: partlyPublished, tagCommit: earlier })).toEqual({
    release: true,
    commit: earlier,
    placeTag: false,
    problems: [],
  });
});

test("counts a published platform package as a started release", () => {
  const platformPublished = [
    pkg("pstdio", "0.43.0", ["0.42.0"]),
    pkg("@pstdio/cli-linux-x64", "0.43.0", ["0.42.0", "0.43.0"]),
  ];
  expect(plan({ packages: platformPublished, tagCommit: earlier })).toEqual({
    release: true,
    commit: earlier,
    placeTag: false,
    problems: [],
  });
});

test("stops when packages are on npm but the release tag is missing", () => {
  const result = plan({ packages: [pkg("pstdio", "0.43.0", ["0.43.0"])] });
  expect(result.release && result.problems).toEqual([expect.stringContaining("pstdio@0.43.0 does not exist")]);
});

test("rejects a public package that does not exist on npm", () => {
  const result = plan({ packages: [...unpublished, pkg("pstdio-artifacts", "0.43.0", null)] });
  expect(result.release && result.problems).toEqual([expect.stringContaining("pstdio-artifacts is not on npm")]);
});

test("leaves patch candidates to manual patch runs, including verification-only candidates", () => {
  expect(plan({ tagCommit: earlier, patchBaseTag: "pstdio@0.42.0" })).toEqual({ release: false });
  expect(
    plan({ tagCommit: earlier, patchBaseTag: "pstdio@0.42.0", packages: [pkg("pstdio", "0.43.0", ["0.43.0"])] }),
  ).toEqual({ release: false });
});
