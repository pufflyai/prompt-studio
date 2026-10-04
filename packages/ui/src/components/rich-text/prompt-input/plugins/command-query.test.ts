import { expect, test } from "bun:test";
import { matchCommandQuery } from "./command-query";

test("completes a command at the caret after an objective", () => {
  expect(matchCommandQuery("Finish the migration /go")).toEqual({
    leadOffset: 21,
    matchingString: "go",
    replaceableString: "/go",
  });
  expect(matchCommandQuery("/goal")).toEqual({ leadOffset: 0, matchingString: "goal", replaceableString: "/goal" });
});

test("leaves paths, URLs, literal slash fragments and finished arguments as text", () => {
  for (const text of ["src/goal", "https://example.com/goal", "`/goal", "#goal", "/goal objective"])
    expect(matchCommandQuery(text)).toBeNull();
});
