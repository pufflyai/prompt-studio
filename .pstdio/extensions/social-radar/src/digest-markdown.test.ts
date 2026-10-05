import { expect, test } from "bun:test";
import { foundThread, newPost } from "./commands/test-context";
import { buildDigestMarkdown } from "./digest-markdown";
import type { FoundThread, NewPost, Run } from "./schemas";
import { defaults } from "./settings";

const now = "2026-10-04T07:00:00.000Z";
const run: Run = { id: "run-2", status: "done", sessionId: "session-2", startedAt: now, finishedAt: now };

test("keeps parentheses in the summary as plain text", () => {
  const markdown = buildDigestMarkdown(
    { ...run, summary: "Six sites were unavailable (one failed CLI attempt)." },
    [],
    [],
    defaults.budgets,
  );
  // The file view reads \( ... \) as inline math.
  expect(markdown).not.toContain("\\(");
});

test("names new-post sources by thread title, including threads from earlier runs", () => {
  const source: FoundThread = { ...foundThread("run-1"), id: "thread-1", status: "new", foundAt: now };
  const post: NewPost = {
    ...newPost("run-2"),
    id: "post-1",
    status: "idea",
    foundAt: now,
    basedOn: ["thread-1", "abc123"],
  };
  const markdown = buildDigestMarkdown(run, [source, post], [], defaults.budgets);
  expect(markdown).toContain(source.title);
  expect(markdown).not.toContain("thread-1");
  expect(markdown).toContain("abc123");
});
