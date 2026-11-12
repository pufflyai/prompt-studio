import { expect, test } from "bun:test";
import { fitReleaseBody, releaseBodyLimit } from "./release-body";

const compare = "https://github.com/pufflyai/prompt-studio/compare/pstdio@0.46.0...pstdio@0.47.0";

test("keeps GitHub's generated pull request list when the body fits", () => {
  const body = fitReleaseBody("## pstdio\n\n- Change\n", "## What's Changed\n* PR by @someone\n", compare);
  expect(body).toBe("## pstdio\n\n- Change\n\n## What's Changed\n* PR by @someone\n");
});

test("replaces a generated list that would exceed the limit with a compare link", () => {
  // 0.47.0: 86,390 characters of changelog notes plus GitHub's list exceeded 125,000.
  const notes = `## pstdio\n\n${"- A change.\n".repeat(7_000)}`;
  const generated = `## What's Changed\n${"* A pull request\n".repeat(3_000)}`;
  const body = fitReleaseBody(notes, generated, compare);
  expect(body.length).toBeLessThanOrEqual(releaseBodyLimit);
  expect(body).toBe(`${notes.trimEnd()}\n\n**Full Changelog**: ${compare}\n`);
});

test("shortens notes that alone exceed the limit at a line boundary", () => {
  const notes = `## pstdio\n\n${"- A change.\n".repeat(20_000)}`;
  const body = fitReleaseBody(notes, "", compare);
  expect(body.length).toBeLessThanOrEqual(releaseBodyLimit);
  expect(body).toStartWith("## pstdio\n\n- A change.\n");
  expect(body).toContain("- A change.\n\n_These notes are shortened");
  expect(body).toEndWith(`**Full Changelog**: ${compare}\n`);
});
