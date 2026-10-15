import { expect, test } from "bun:test";
import { sessionMenuPage } from "./session-menu-page";

const sessions = Array.from({ length: 65 }, (_, index) => ({
  id: `s${index}`,
  title: `Conversation ${index}`,
  resource: { type: "session", id: `s${index}` },
}));
test("session search reaches unloaded sessions and pages through the complete history", () => {
  const first = sessionMenuPage(sessions, { query: "" });
  expect(first.rows.length).toBeLessThan(sessions.length);
  const ids: string[] = first.rows.map((row) => row.id);
  let cursor = first.nextCursor;
  while (cursor) {
    const page = sessionMenuPage(sessions, { query: "", cursor });
    ids.push(...page.rows.map((row) => row.id));
    cursor = page.nextCursor;
  }
  expect(ids).toEqual(sessions.map((session) => session.id));
  expect(sessionMenuPage(sessions, { query: "CONVERSATION 64" }).rows.map((row) => row.id)).toEqual(["s64"]);
  expect(sessionMenuPage(sessions, { query: "unmatched" }).rows).toEqual([]);
});
